-- CyberOsintIndia app/store/referral/custom-tool migration.
-- Additive and safe to re-run. Existing rows are retained.
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists plan_name text not null default 'Free';
alter table public.profiles add column if not exists plan_expires_at timestamptz;
alter table public.profiles add column if not exists pending_referral_code text;
alter table public.profiles add column if not exists referral_code text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists status text not null default 'active';
alter table public.profiles add column if not exists credits integer not null default 0;
create unique index if not exists profiles_username_unique on public.profiles(lower(username)) where username is not null;
create unique index if not exists profiles_referral_code_unique on public.profiles(referral_code) where referral_code is not null;
alter table public.tools add column if not exists handler text not null default 'custom';
alter table public.tools add column if not exists input_label text not null default 'Enter query';
alter table public.tools add column if not exists credit_cost integer not null default 1;
alter table public.tools add column if not exists result_note text not null default '';
alter table public.tools add column if not exists config jsonb not null default '{}'::jsonb;
do $$ begin if not exists(select 1 from pg_constraint where conname='tools_handler_allowed') then alter table public.tools add constraint tools_handler_allowed check(handler in ('ip','domain','dns','email','url','username','social','breach','image','custom')) not valid; end if; end $$;
alter table public.payment_records add column if not exists plan_id uuid references public.premium_plans(id) on delete set null;
alter table public.payment_records add column if not exists proof_url text;
alter table public.payment_records add column if not exists user_note text;
alter table public.payment_records add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.payment_records add column if not exists reviewed_at timestamptz;
drop policy if exists "profiles read own or admin" on public.profiles;
create policy "profiles read own or admin" on public.profiles for select to authenticated using(id=(select auth.uid()) or (select private.is_admin()));
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
grant select on public.profiles to authenticated;
grant update(username,display_name,bio,avatar_url,updated_at) on public.profiles to authenticated;
alter table public.payment_records enable row level security;
drop policy if exists "payments own or admin read" on public.payment_records;
create policy "payments own or admin read" on public.payment_records for select to authenticated using(user_id=(select auth.uid()) or (select private.is_admin()));
drop policy if exists "payments own insert" on public.payment_records;
create policy "payments own insert" on public.payment_records for insert to authenticated with check(user_id=(select auth.uid()) and status='pending');
drop policy if exists "payments admin update" on public.payment_records;
create policy "payments admin update" on public.payment_records for update to authenticated using((select private.is_admin())) with check((select private.is_admin()));
grant select,insert,update on public.payment_records to authenticated;
drop policy if exists "plans read active or admin" on public.premium_plans;
create policy "plans read active or admin" on public.premium_plans for select to anon,authenticated using(is_active=true or (select private.is_admin()));
drop policy if exists "credits own or admin read" on public.credit_transactions;
create policy "credits own or admin read" on public.credit_transactions for select to authenticated using(user_id=(select auth.uid()) or (select private.is_admin()));
drop policy if exists "referrals own or admin read" on public.referral_claims;
create policy "referrals own or admin read" on public.referral_claims for select to authenticated using(referrer_id=(select auth.uid()) or referred_id=(select auth.uid()) or (select private.is_admin()));
create or replace function public.consume_tool_credit(p_tool_slug text,p_query text)
returns integer language plpgsql security definer set search_path='' as $$
declare uid uuid := (select auth.uid()); cost integer; remaining integer;
begin
 if uid is null then raise exception 'Sign in required'; end if;
 select credit_cost into cost from public.tools where slug=p_tool_slug and enabled=true;
 if not found then raise exception 'Tool is unavailable'; end if;
 if cost is null or cost<0 then raise exception 'Invalid tool credit configuration'; end if;
 update public.profiles set credits=credits-cost,updated_at=now() where id=uid and status='active' and credits>=cost returning credits into remaining;
 if not found then raise exception 'Insufficient credits or inactive account'; end if;
 insert into public.credit_transactions(user_id,amount,delta,reason) values(uid,-cost,-cost,'Tool use: '||left(p_tool_slug,80));
 insert into public.search_history(user_id,tool_slug,input_summary,status) values(uid,p_tool_slug,left(p_query,500),'success');
 return remaining;
end $$;
revoke all on function public.consume_tool_credit(text,text) from public,anon;
grant execute on function public.consume_tool_credit(text,text) to authenticated;
create or replace function public.handle_profile_referral()
returns trigger language plpgsql security definer set search_path='' as $$
declare referrer uuid; reward_count integer:=0; welcome_count integer:=0; code text;
begin
 code:=nullif(new.raw_user_meta_data->>'referral_code','');
 select coalesce((value->>'credits')::integer,0) into welcome_count from public.site_settings where key='default_signup_credits';
 welcome_count:=coalesce(welcome_count,0);
 if welcome_count>0 then
  update public.profiles set credits=credits+welcome_count where id=new.id;
  insert into public.credit_transactions(user_id,amount,delta,reason) values(new.id,welcome_count,welcome_count,'Welcome credits');
 end if;
 if code is not null then
  select id into referrer from public.profiles where referral_code=code and id<>new.id and status='active' limit 1;
  if referrer is not null then
   select coalesce((value->>'credits')::integer,0) into reward_count from public.site_settings where key='referral_reward';
   reward_count:=coalesce(reward_count,0);
   insert into public.referral_claims(referrer_id,referred_id,reward,status) values(referrer,new.id,reward_count,'qualified') on conflict do nothing;
   if reward_count>0 then
    update public.profiles set credits=credits+reward_count where id=referrer;
    insert into public.credit_transactions(user_id,amount,delta,reason) values(referrer,reward_count,reward_count,'Referral reward');
   end if;
  end if;
 end if;
 return new;
end $$;
drop trigger if exists cyberx_profile_referral_rewards on auth.users;
drop trigger if exists zz_cyberx_profile_referral_rewards on auth.users;
create trigger zz_cyberx_profile_referral_rewards after insert on auth.users for each row execute function public.handle_profile_referral();
create or replace function public.admin_review_payment(p_payment_id uuid,p_approve boolean)
returns void language plpgsql security definer set search_path='' as $$
declare p public.payment_records%rowtype; plan public.premium_plans%rowtype;
begin
 if (select auth.uid()) is null or not private.is_admin() then raise exception 'Admin access required'; end if;
 select * into p from public.payment_records where id=p_payment_id for update;
 if not found then raise exception 'Payment not found'; end if;
 if p.status<>'pending' then raise exception 'Payment has already been reviewed'; end if;
 if p_approve then
  if p.plan_id is null then raise exception 'Payment has no selected plan'; end if;
  select * into plan from public.premium_plans where id=p.plan_id and is_active=true;
  if not found then raise exception 'Selected plan is unavailable'; end if;
  update public.profiles set credits=credits+plan.credits,plan_name=plan.name,plan_expires_at=greatest(coalesce(plan_expires_at,now()),now())+(plan.duration_days||' days')::interval,updated_at=now() where id=p.user_id;
  insert into public.credit_transactions(user_id,amount,delta,reason,created_by) values(p.user_id,plan.credits,plan.credits,'Approved plan: '||plan.name,(select auth.uid()));
  update public.payment_records set status='success',reviewed_by=(select auth.uid()),reviewed_at=now() where id=p_payment_id;
 else update public.payment_records set status='failed',reviewed_by=(select auth.uid()),reviewed_at=now() where id=p_payment_id; end if;
end $$;
revoke all on function public.admin_review_payment(uuid,boolean) from public,anon;
grant execute on function public.admin_review_payment(uuid,boolean) to authenticated;
insert into public.site_settings(key,value) values('payment_qr_url','""'::jsonb),('payment_instructions','"Upload payment proof after paying. Admin approval is required before credits are added."'::jsonb),('referral_reward','{"credits":3}'::jsonb),('default_signup_credits','{"credits":1}'::jsonb) on conflict(key) do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('cyberx-user-media','cyberx-user-media',false,5242880,array['image/png','image/jpeg','image/webp']) on conflict(id) do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('cyberx-avatars','cyberx-avatars',false,5242880,array['image/png','image/jpeg','image/webp']) on conflict(id) do nothing;
drop policy if exists "user media read own" on storage.objects;
create policy "user media read own" on storage.objects for select to authenticated using(bucket_id='cyberx-user-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "user media insert own" on storage.objects;
create policy "user media insert own" on storage.objects for insert to authenticated with check(bucket_id='cyberx-user-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "user media update own" on storage.objects;
create policy "user media update own" on storage.objects for update to authenticated using(bucket_id='cyberx-user-media' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='cyberx-user-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "cyberx avatar read" on storage.objects;
create policy "cyberx avatar read" on storage.objects for select to authenticated using(bucket_id='cyberx-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "cyberx avatar insert" on storage.objects;
create policy "cyberx avatar insert" on storage.objects for insert to authenticated with check(bucket_id='cyberx-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "cyberx avatar update" on storage.objects;
create policy "cyberx avatar update" on storage.objects for update to authenticated using(bucket_id='cyberx-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='cyberx-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create or replace function public.ensure_profile_referral_code()
returns trigger language plpgsql security definer set search_path='' as $$
begin if new.referral_code is null then new.referral_code:=upper(substr(replace(new.id::text,'-',''),1,10)); end if; return new; end $$;
drop trigger if exists ensure_profile_referral_code on public.profiles;
create trigger ensure_profile_referral_code before insert on public.profiles for each row execute function public.ensure_profile_referral_code();
update public.profiles set referral_code=upper(substr(replace(id::text,'-',''),1,10)) where referral_code is null;

-- Enable the nine supported public-source tools and keep phone-person lookup disabled.
update public.tools set handler=case slug
 when 'username-tracker' then 'username' when 'email-validator' then 'email'
 when 'ip-lookup' then 'ip' when 'domain-lookup' then 'domain'
 when 'url-safety' then 'url' when 'dns-lookup' then 'dns'
 when 'reverse-image-search' then 'image' when 'social-media-analyzer' then 'social'
 when 'breach-self-check' then 'breach' else handler end,
 enabled=(slug in ('username-tracker','email-validator','ip-lookup','domain-lookup','url-safety','dns-lookup','reverse-image-search','social-media-analyzer','breach-self-check'))
 where slug in ('username-tracker','email-validator','ip-lookup','domain-lookup','url-safety','dns-lookup','reverse-image-search','social-media-analyzer','breach-self-check','number-info','phone-validator','image-metadata');

-- Rewards are granted once only after email confirmation (or immediately for verified OAuth).
create table if not exists public.signup_reward_claims(user_id uuid primary key references auth.users(id) on delete cascade,created_at timestamptz not null default now());
alter table public.signup_reward_claims enable row level security;
revoke all on public.signup_reward_claims from public,anon,authenticated;
create unique index if not exists referral_claims_referred_unique on public.referral_claims(referred_id);
create or replace function public.handle_profile_referral()
returns trigger language plpgsql security definer set search_path='' as $$
declare referrer uuid; reward_count integer:=0; welcome_count integer:=0; code text; claimed uuid;
begin
 if new.email_confirmed_at is null then return new; end if;
 insert into public.signup_reward_claims(user_id) values(new.id) on conflict do nothing returning user_id into claimed;
 if claimed is null then return new; end if;
 select coalesce((value->>'credits')::integer,0) into welcome_count from public.site_settings where key='default_signup_credits';
 welcome_count:=coalesce(welcome_count,0);
 if welcome_count>0 then
  update public.profiles set credits=credits+welcome_count where id=new.id;
  insert into public.credit_transactions(user_id,amount,delta,reason) values(new.id,welcome_count,welcome_count,'Welcome credits');
 end if;
 code:=nullif(new.raw_user_meta_data->>'referral_code','');
 if code is not null then
  select id into referrer from public.profiles where referral_code=code and id<>new.id and status='active' limit 1;
  if referrer is not null then
   select coalesce((value->>'credits')::integer,0) into reward_count from public.site_settings where key='referral_reward';
   reward_count:=coalesce(reward_count,0);
   insert into public.referral_claims(referrer_id,referred_id,reward,status) values(referrer,new.id,reward_count,'qualified')
   on conflict(referred_id) do nothing returning referred_id into claimed;
   if claimed is not null and reward_count>0 then
    update public.profiles set credits=credits+reward_count where id=referrer;
    insert into public.credit_transactions(user_id,amount,delta,reason) values(referrer,reward_count,reward_count,'Referral reward');
   end if;
  end if;
 end if;
 return new;
end $$;
drop trigger if exists cyberx_profile_referral_rewards on auth.users;
drop trigger if exists zz_cyberx_profile_referral_rewards on auth.users;
drop trigger if exists zz_cyberx_profile_referral_rewards_confirm on auth.users;
create trigger zz_cyberx_profile_referral_rewards after insert on auth.users for each row execute function public.handle_profile_referral();
create trigger zz_cyberx_profile_referral_rewards_confirm after update of email_confirmed_at on auth.users
for each row when(old.email_confirmed_at is null and new.email_confirmed_at is not null)
execute function public.handle_profile_referral();
