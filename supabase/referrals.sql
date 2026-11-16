alter table public.profiles add column if not exists referral_code text unique;
alter table public.profiles add column if not exists pending_referral_code text;
update public.profiles set referral_code=upper(substr(encode(gen_random_bytes(5),'hex'),1,8)) where referral_code is null;
create or replace function public.assign_referral_code() returns trigger language plpgsql as $$
begin if new.referral_code is null then new.referral_code=upper(substr(encode(gen_random_bytes(5),'hex'),1,8)); end if; return new; end; $$;
drop trigger if exists profiles_referral_code on public.profiles;
create trigger profiles_referral_code before insert on public.profiles for each row execute function public.assign_referral_code();
create table if not exists public.referral_claims(
 id uuid primary key default gen_random_uuid(),
 referrer_id uuid not null references public.profiles(id) on delete cascade,
 referred_id uuid not null unique references public.profiles(id) on delete cascade,
 reward integer not null default 3,
 created_at timestamptz not null default now(),
 check(referrer_id<>referred_id)
);
alter table public.referral_claims enable row level security;
drop policy if exists "referrals own read" on public.referral_claims;
create policy "referrals own read" on public.referral_claims for select using(auth.uid()=referrer_id or auth.uid()=referred_id or public.is_admin());
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public
as $$ begin
 insert into public.profiles(id,email,display_name,credits,pending_referral_code)
 values(new.id,new.email,coalesce(new.raw_user_meta_data->>'display_name',''),5,nullif(upper(trim(new.raw_user_meta_data->>'referral_code')),''))
 on conflict(id) do nothing;
 insert into public.credit_transactions(user_id,amount,reason) values(new.id,5,'Welcome credits');
 return new;
end; $$;
create or replace function public.claim_referral_reward() returns jsonb
language plpgsql security definer set search_path=public
as $$ declare v_code text; v_referrer uuid; v_confirmed timestamptz;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select email_confirmed_at into v_confirmed from auth.users where id=auth.uid();
 if v_confirmed is null then raise exception 'Verify your email before claiming a referral'; end if;
 select pending_referral_code into v_code from public.profiles where id=auth.uid();
 if v_code is null or v_code='' then raise exception 'No referral code was supplied at registration'; end if;
 select id into v_referrer from public.profiles where referral_code=v_code;
 if v_referrer is null then raise exception 'Referral code is invalid'; end if;
 if v_referrer=auth.uid() then raise exception 'You cannot use your own referral code'; end if;
 insert into public.referral_claims(referrer_id,referred_id,reward) values(v_referrer,auth.uid(),3);
 update public.profiles set credits=credits+3 where id in (v_referrer,auth.uid());
 insert into public.credit_transactions(user_id,amount,reason) values(v_referrer,3,'Referral reward'),(auth.uid(),3,'Referral signup reward');
 update public.profiles set pending_referral_code=null where id=auth.uid();
 return jsonb_build_object('success',true,'reward',3);
exception when unique_violation then raise exception 'Referral has already been claimed for this account';
end; $$;
grant execute on function public.claim_referral_reward() to authenticated;
