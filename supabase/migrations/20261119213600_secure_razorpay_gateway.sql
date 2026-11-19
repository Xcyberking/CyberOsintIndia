create table if not exists public.payment_gateway_secrets (
  id text primary key check (id = 'razorpay'),
  key_id text not null,
  encrypted_secret text not null,
  iv text not null,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.payment_gateway_secrets enable row level security;
revoke all on table public.payment_gateway_secrets from anon, authenticated;
grant all on table public.payment_gateway_secrets to service_role;

alter table public.payment_records
  add column if not exists gateway_payment_id text,
  add column if not exists gateway_signature text,
  add column if not exists paid_at timestamptz;
create unique index if not exists payment_records_gateway_payment_id_uidx
  on public.payment_records(gateway_payment_id) where gateway_payment_id is not null;
create index if not exists payment_records_plan_id_idx on public.payment_records(plan_id);
create index if not exists payment_records_reviewed_by_idx on public.payment_records(reviewed_by);

create or replace function public.complete_razorpay_payment(
  p_payment_record_id uuid,
  p_user_id uuid,
  p_payment_id text,
  p_signature text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  payment_row public.payment_records%rowtype;
  plan_row public.premium_plans%rowtype;
  profile_row public.profiles%rowtype;
begin
  select * into payment_row from public.payment_records
    where id = p_payment_record_id and user_id = p_user_id and provider = 'razorpay'
    for update;
  if not found then raise exception 'Payment record not found'; end if;
  if payment_row.status = 'success' then return jsonb_build_object('ok', true, 'already_processed', true); end if;
  if payment_row.status <> 'pending' then raise exception 'Payment is not pending'; end if;
  if payment_row.plan_id is null then raise exception 'Payment plan is missing'; end if;
  select * into plan_row from public.premium_plans where id = payment_row.plan_id and is_active = true;
  if not found then raise exception 'Plan is unavailable'; end if;
  select * into profile_row from public.profiles where id = p_user_id for update;
  if not found then raise exception 'User profile not found'; end if;
  update public.profiles
    set credits = credits + plan_row.credits, plan_name = plan_row.name,
        plan_expires_at = greatest(coalesce(plan_expires_at, now()), now()) + make_interval(days => plan_row.duration_days),
        updated_at = now()
    where id = p_user_id;
  insert into public.credit_transactions(user_id, amount, delta, reason, created_by)
    values (p_user_id, plan_row.credits, plan_row.credits, 'Razorpay purchase: ' || plan_row.name, p_user_id);
  update public.payment_records
    set status = 'success', gateway_payment_id = p_payment_id, gateway_signature = p_signature,
        paid_at = now(), user_note = coalesce(user_note, '') || ' | verified by Razorpay signature'
    where id = p_payment_record_id;
  return jsonb_build_object('ok', true, 'credits_added', plan_row.credits, 'plan', plan_row.name);
end;
$$;
revoke all on function public.complete_razorpay_payment(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.complete_razorpay_payment(uuid, uuid, text, text) to service_role;

revoke execute on function public.ensure_profile_referral_code() from public, anon, authenticated;
revoke execute on function public.handle_profile_referral() from public, anon, authenticated;