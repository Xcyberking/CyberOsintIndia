-- Configurable, one-time signup and referral rewards.
-- New accounts start at zero; the auth confirmation trigger grants the configured reward exactly once.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.profiles (
    id, email, display_name, role, credits, pending_referral_code
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'display_name', ''),
    'user',
    0,
    nullif(upper(trim(coalesce(new.raw_user_meta_data ->> 'referral_code', ''))), '')
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(nullif(excluded.display_name, ''), public.profiles.display_name),
        pending_referral_code = coalesce(public.profiles.pending_referral_code, excluded.pending_referral_code);

  return new;
end;
$function$;

create or replace function public.handle_profile_referral()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_referrer uuid;
  v_code text;
  v_signup_reward integer;
  v_referred_reward integer;
  v_referrer_reward integer;
  v_signup_claim uuid;
  v_referral_claim uuid;
begin
  if new.email_confirmed_at is null then
    return new;
  end if;

  insert into public.signup_reward_claims(user_id)
  values(new.id)
  on conflict(user_id) do nothing
  returning user_id into v_signup_claim;

  if v_signup_claim is null then
    return new;
  end if;

  select coalesce((select (s.value->>'credits')::integer from public.site_settings s where s.key='default_signup_credits'),3)
    into v_signup_reward;
  select coalesce((select (s.value->>'credits')::integer from public.site_settings s where s.key='referral_new_user_credits'),7)
    into v_referred_reward;
  select coalesce((select (s.value->>'credits')::integer from public.site_settings s where s.key='referral_reward'),3)
    into v_referrer_reward;

  v_signup_reward := greatest(0, coalesce(v_signup_reward,3));
  v_referred_reward := greatest(0, coalesce(v_referred_reward,7));
  v_referrer_reward := greatest(0, coalesce(v_referrer_reward,3));

  v_code := coalesce(
    nullif(upper(trim(coalesce(new.raw_user_meta_data->>'referral_code',''))),''),
    (select nullif(upper(trim(p.pending_referral_code)),'') from public.profiles p where p.id=new.id)
  );

  if v_code is not null then
    select p.id into v_referrer
      from public.profiles p
     where upper(p.referral_code)=v_code
       and p.id<>new.id
       and p.status='active'
     limit 1;
  end if;

  if v_referrer is not null then
    insert into public.referral_claims(referrer_id,referred_id,reward,status)
    values(v_referrer,new.id,v_referrer_reward,'qualified')
    on conflict(referred_id) do nothing
    returning referred_id into v_referral_claim;

    if v_referral_claim is not null then
      if v_referred_reward>0 then
        update public.profiles set credits=credits+v_referred_reward,updated_at=now() where id=new.id;
        insert into public.credit_transactions(user_id,amount,delta,reason)
        values(new.id,v_referred_reward,v_referred_reward,'Referral signup bonus');
      end if;

      if v_referrer_reward>0 then
        update public.profiles set credits=credits+v_referrer_reward,updated_at=now() where id=v_referrer;
        insert into public.credit_transactions(user_id,amount,delta,reason)
        values(v_referrer,v_referrer_reward,v_referrer_reward,'Referral reward');
      end if;
    elsif v_signup_reward>0 then
      update public.profiles set credits=credits+v_signup_reward,updated_at=now() where id=new.id;
      insert into public.credit_transactions(user_id,amount,delta,reason)
      values(new.id,v_signup_reward,v_signup_reward,'Signup credits');
    end if;
  elsif v_signup_reward>0 then
    update public.profiles set credits=credits+v_signup_reward,updated_at=now() where id=new.id;
    insert into public.credit_transactions(user_id,amount,delta,reason)
    values(new.id,v_signup_reward,v_signup_reward,'Signup credits');
  end if;

  update public.profiles
     set pending_referral_code=null,
         updated_at=now()
   where id=new.id;

  return new;
end;
$function$;

insert into public.site_settings(key,value,updated_at)
values
  ('default_signup_credits',jsonb_build_object('credits',3),now()),
  ('referral_new_user_credits',jsonb_build_object('credits',7),now()),
  ('referral_reward',jsonb_build_object('credits',3),now())
on conflict(key) do update
set value=excluded.value,updated_at=now();

drop policy if exists "public payment settings read" on public.site_settings;
create policy "public payment settings read"
on public.site_settings
for select
to anon, authenticated
using (key = any(array[
  'payment_qr_url',
  'payment_instructions',
  'default_signup_credits',
  'referral_new_user_credits',
  'referral_reward'
]));

-- These are trigger-only routines. The legacy callable referral RPC is retired;
-- signup/referral credits are now issued by the verified-email trigger only.
revoke all on function public.claim_referral_reward() from public, anon, authenticated;
revoke all on function public.handle_profile_referral() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
