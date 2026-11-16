-- CyberX OSINT: complete database setup. Idempotent: safe to re-run on a fresh Supabase project.

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text,
 display_name text not null default '',
 bio text not null default '' check(char_length(bio)<=160),
 role text not null default 'user' check(role in ('user','admin')),
 credits integer not null default 5 check(credits>=0),
 referral_code text unique,
 pending_referral_code text,
 created_at timestamptz not null default now()
);
-- upgrade path for an older database
alter table public.profiles add column if not exists bio text not null default '';
alter table public.profiles add column if not exists referral_code text unique;
alter table public.profiles add column if not exists pending_referral_code text;

create table if not exists public.tools (
 id uuid primary key default gen_random_uuid(),
 slug text unique not null check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 name text not null,
 description text not null default '',
 category text not null default 'General',
 credit_cost integer not null default 1 check(credit_cost between 0 and 1000),
 enabled boolean not null default true,
 created_at timestamptz not null default now()
);

-- Private API settings. Only admins (RLS) and the server service role can read this table.
create table if not exists public.tool_apis (
 slug text primary key references public.tools(slug) on delete cascade on update cascade,
 url text not null,
 method text not null default 'GET' check(method in ('GET','POST')),
 param_name text not null default 'query',
 headers_json text not null default '{}',
 body_template text not null default '',
 content_type text not null default 'application/json',
 updated_at timestamptz not null default now()
);

create table if not exists public.credit_transactions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 amount integer not null,
 reason text not null,
 created_at timestamptz not null default now()
);

create table if not exists public.search_history (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 tool_slug text not null,
 input_summary text not null,
 status text not null default 'success',
 created_at timestamptz not null default now()
);

create table if not exists public.site_settings (
 key text primary key,
 value jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);

create table if not exists public.announcements (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 body text not null,
 active boolean not null default true,
 created_at timestamptz not null default now()
);

create table if not exists public.referral_claims (
 id uuid primary key default gen_random_uuid(),
 referrer_id uuid not null references public.profiles(id) on delete cascade,
 referred_id uuid not null unique references public.profiles(id) on delete cascade,
 reward integer not null default 5,
 created_at timestamptz not null default now(),
 check(referrer_id<>referred_id)
);

create table if not exists public.health_checks (
 id uuid primary key default gen_random_uuid(),
 service text not null,
 status text not null check(status in ('online','degraded','offline')),
 latency_ms integer,
 details text not null default '',
 checked_at timestamptz not null default now()
);

create index if not exists search_history_user_idx on public.search_history(user_id, created_at desc);
create index if not exists search_history_created_idx on public.search_history(created_at desc);
create index if not exists credit_tx_user_idx on public.credit_transactions(user_id, created_at desc);
create index if not exists tools_enabled_idx on public.tools(enabled, created_at desc);
create index if not exists announcements_created_at_idx on public.announcements(created_at desc);
create index if not exists health_checks_checked_at_idx on public.health_checks(checked_at desc);

-- Functions -------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin'); $$;

create or replace function public.assign_referral_code() returns trigger language plpgsql as $$
declare v text;
begin
 if new.referral_code is null then
  loop
   v := upper(substr(md5(random()::text || clock_timestamp()::text || new.id::text),1,8));
   exit when not exists(select 1 from public.profiles where referral_code=v);
  end loop;
  new.referral_code := v;
 end if;
 return new;
end; $$;
drop trigger if exists profiles_referral_code on public.profiles;
create trigger profiles_referral_code before insert on public.profiles for each row execute function public.assign_referral_code();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public
as $$ begin
 insert into public.profiles(id,email,display_name,credits,pending_referral_code)
 values(new.id,new.email,
  left(coalesce(nullif(new.raw_user_meta_data->>'display_name',''),new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name',''),60),
  5,
  nullif(left(upper(trim(coalesce(new.raw_user_meta_data->>'referral_code',''))),8),''))
 on conflict(id) do nothing;
 insert into public.credit_transactions(user_id,amount,reason) values(new.id,5,'Welcome credits');
 return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.consume_tool_credit(p_tool_slug text) returns jsonb
language plpgsql security definer set search_path=public
as $$ declare v_cost integer; v_balance integer;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select credit_cost into v_cost from public.tools where slug=p_tool_slug and enabled=true;
 if v_cost is null then raise exception 'Tool unavailable'; end if;
 if public.is_admin() or v_cost=0 then return jsonb_build_object('charged',0,'balance',null,'admin_unlimited',public.is_admin()); end if;
 update public.profiles set credits=credits-v_cost where id=auth.uid() and credits>=v_cost returning credits into v_balance;
 if not found then raise exception 'Insufficient credits'; end if;
 insert into public.credit_transactions(user_id,amount,reason) values(auth.uid(),-v_cost,'Tool usage: '||p_tool_slug);
 return jsonb_build_object('charged',v_cost,'balance',v_balance,'admin_unlimited',false);
end; $$;

-- Server-only (service role): gives credits back when a tool API call fails after charging.
create or replace function public.refund_credit(p_user_id uuid,p_amount integer,p_reason text) returns void
language plpgsql security definer set search_path=public
as $$ begin
 if p_amount is null or p_amount<=0 or p_amount>1000 then raise exception 'Invalid refund'; end if;
 update public.profiles set credits=credits+p_amount where id=p_user_id;
 if not found then raise exception 'User not found'; end if;
 insert into public.credit_transactions(user_id,amount,reason) values(p_user_id,p_amount,left(coalesce(p_reason,'Refund'),160));
end; $$;

create or replace function public.admin_adjust_credits(p_user_id uuid,p_amount integer,p_reason text) returns integer
language plpgsql security definer set search_path=public
as $$ declare v_balance integer;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 if p_amount=0 or abs(p_amount)>10000 then raise exception 'Invalid credit adjustment'; end if;
 update public.profiles set credits=greatest(0,credits+p_amount) where id=p_user_id returning credits into v_balance;
 if not found then raise exception 'User not found'; end if;
 insert into public.credit_transactions(user_id,amount,reason) values(p_user_id,p_amount,left(coalesce(p_reason,'Admin adjustment'),160));
 return v_balance;
end; $$;

create or replace function public.admin_set_user_role(p_user_id uuid,p_role text) returns void
language plpgsql security definer set search_path=public
as $$ begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 if p_role not in ('user','admin') then raise exception 'Invalid role'; end if;
 if p_user_id=auth.uid() then raise exception 'You cannot change your own role'; end if;
 if p_role='user' and not exists(select 1 from public.profiles where role='admin' and id<>p_user_id) then raise exception 'At least one admin must remain'; end if;
 update public.profiles set role=p_role where id=p_user_id;
 if not found then raise exception 'User not found'; end if;
end; $$;

-- Referral: new user gets 10 credits, referrer gets 5. Needs a verified email.
create or replace function public.claim_referral_reward() returns jsonb
language plpgsql security definer set search_path=public
as $$ declare v_uid uuid := auth.uid(); v_code text; v_referrer uuid; v_confirmed timestamptz;
begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 select pending_referral_code into v_code from public.profiles where id=v_uid;
 if v_code is null or v_code='' then return jsonb_build_object('success',false,'reason','none'); end if;
 select email_confirmed_at into v_confirmed from auth.users where id=v_uid;
 if v_confirmed is null then return jsonb_build_object('success',false,'reason','unverified'); end if;
 select id into v_referrer from public.profiles where referral_code=v_code;
 if v_referrer is null or v_referrer=v_uid then
  update public.profiles set pending_referral_code=null where id=v_uid;
  return jsonb_build_object('success',false,'reason','invalid');
 end if;
 insert into public.referral_claims(referrer_id,referred_id,reward) values(v_referrer,v_uid,5);
 update public.profiles set credits=credits+5 where id=v_referrer;
 update public.profiles set credits=credits+10, pending_referral_code=null where id=v_uid;
 insert into public.credit_transactions(user_id,amount,reason) values(v_referrer,5,'Referral reward'),(v_uid,10,'Referral signup reward');
 return jsonb_build_object('success',true,'reward',10);
exception when unique_violation then
 update public.profiles set pending_referral_code=null where id=v_uid;
 return jsonb_build_object('success',false,'reason','already');
end; $$;

-- Row level security ----------------------------------------------------
alter table public.profiles enable row level security;
alter table public.tools enable row level security;
alter table public.tool_apis enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.search_history enable row level security;
alter table public.site_settings enable row level security;
alter table public.announcements enable row level security;
alter table public.referral_claims enable row level security;
alter table public.health_checks enable row level security;

drop policy if exists "profiles read own or admin" on public.profiles;
create policy "profiles read own or admin" on public.profiles for select using(auth.uid()=id or public.is_admin());
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update using(auth.uid()=id) with check(auth.uid()=id);
-- Users may edit only display_name and bio. Role and credits can never be changed from the browser.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update(display_name, bio) on public.profiles to authenticated;

drop policy if exists "tools enabled read" on public.tools;
create policy "tools enabled read" on public.tools for select using(enabled or public.is_admin());
drop policy if exists "admin tools manage" on public.tools;
create policy "admin tools manage" on public.tools for all using(public.is_admin()) with check(public.is_admin());

drop policy if exists "tool_apis admin only" on public.tool_apis;
create policy "tool_apis admin only" on public.tool_apis for all using(public.is_admin()) with check(public.is_admin());
revoke all on public.tool_apis from anon;

drop policy if exists "credits own read" on public.credit_transactions;
create policy "credits own read" on public.credit_transactions for select using(auth.uid()=user_id or public.is_admin());
drop policy if exists "history own read" on public.search_history;
create policy "history own read" on public.search_history for select using(auth.uid()=user_id or public.is_admin());
drop policy if exists "history own insert" on public.search_history;
create policy "history own insert" on public.search_history for insert with check(auth.uid()=user_id);

-- Public may read only the contact block. Everything else in site_settings is admin-only.
drop policy if exists "settings read" on public.site_settings;
drop policy if exists "settings public read" on public.site_settings;
create policy "settings public read" on public.site_settings for select using(key='contact' or public.is_admin());
drop policy if exists "settings admin manage" on public.site_settings;
create policy "settings admin manage" on public.site_settings for all using(public.is_admin()) with check(public.is_admin());

drop policy if exists "announcements read" on public.announcements;
create policy "announcements read" on public.announcements for select using(active or public.is_admin());
drop policy if exists "announcements admin manage" on public.announcements;
create policy "announcements admin manage" on public.announcements for all using(public.is_admin()) with check(public.is_admin());

drop policy if exists "referrals own read" on public.referral_claims;
create policy "referrals own read" on public.referral_claims for select using(auth.uid()=referrer_id or auth.uid()=referred_id or public.is_admin());
drop policy if exists "admins read health checks" on public.health_checks;
create policy "admins read health checks" on public.health_checks for select to authenticated using(public.is_admin());

-- Function permissions --------------------------------------------------
revoke all on function public.consume_tool_credit(text) from public, anon;
revoke all on function public.claim_referral_reward() from public, anon;
revoke all on function public.admin_adjust_credits(uuid,integer,text) from public, anon;
revoke all on function public.admin_set_user_role(uuid,text) from public, anon;
revoke all on function public.refund_credit(uuid,integer,text) from public, anon, authenticated;
grant execute on function public.consume_tool_credit(text) to authenticated;
grant execute on function public.claim_referral_reward() to authenticated;
grant execute on function public.admin_adjust_credits(uuid,integer,text) to authenticated;
grant execute on function public.admin_set_user_role(uuid,text) to authenticated;
grant execute on function public.refund_credit(uuid,integer,text) to service_role;

-- Defaults ---------------------------------------------------------------
insert into public.site_settings(key,value) values
 ('contact', jsonb_build_object('email','','telegram','','whatsapp','','github','https://github.com/Xcyberking/CyberOsintIndia','instagram','','youtube',''))
on conflict(key) do nothing;
