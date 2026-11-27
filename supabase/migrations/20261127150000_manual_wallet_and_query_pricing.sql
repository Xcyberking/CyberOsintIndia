-- Manual wallet deposits and INR-per-query billing.
-- Additive migration: keeps legacy credits/plans intact while introducing a rupee wallet.

alter table public.profiles
  add column if not exists wallet_balance numeric(12,2) not null default 0
  check (wallet_balance >= 0);

alter table public.tools
  add column if not exists price_inr numeric(10,2) not null default 0
  check (price_inr >= 0);

alter table public.payment_records
  add column if not exists plan_id uuid references public.premium_plans(id) on delete set null,
  add column if not exists proof_url text,
  add column if not exists user_note text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists admin_note text;

alter table public.payment_records
  add column if not exists payment_type text not null default 'plan';

alter table public.payment_records
  drop constraint if exists payment_records_payment_type_check;
alter table public.payment_records
  add constraint payment_records_payment_type_check
  check (payment_type in ('plan','wallet'));

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_inr numeric(12,2) not null check (amount_inr <> 0),
  balance_after numeric(12,2) not null check (balance_after >= 0),
  transaction_type text not null check (transaction_type in ('deposit','query_charge','admin_adjustment')),
  reference_id uuid,
  description text not null default '',
  created_at timestamptz not null default now()
);
alter table public.wallet_transactions enable row level security;
drop policy if exists "wallet transactions own or admin read" on public.wallet_transactions;
create policy "wallet transactions own or admin read"
  on public.wallet_transactions for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
revoke all on public.wallet_transactions from anon;
grant select on public.wallet_transactions to authenticated;

-- The browser cannot directly insert or approve deposits. This RPC creates a pending
-- request tied to the authenticated user; the admin must verify receipt independently.
create or replace function public.create_wallet_deposit_request(
  p_amount_inr numeric,
  p_utr text,
  p_proof_url text default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare new_id uuid; normalized_utr text;
begin
  if (select auth.uid()) is null then raise exception 'Sign in required'; end if;
  if p_amount_inr is null or p_amount_inr < 10 or p_amount_inr > 50000
     or round(p_amount_inr,2) <> p_amount_inr then
    raise exception 'Deposit amount must be between ₹10 and ₹50,000';
  end if;
  normalized_utr := left(trim(coalesce(p_utr,'')),80);
  if length(normalized_utr) < 6 then raise exception 'Enter a valid UTR/reference (6–80 characters)'; end if;
  if exists(select 1 from public.payment_records where provider='manual_qr'
      and lower(trim(provider_reference))=lower(normalized_utr)) then
    raise exception 'This UTR/reference has already been submitted';
  end if;
  insert into public.payment_records(user_id,provider,provider_reference,amount_inr,status,
    payment_type,proof_url,user_note)
  values ((select auth.uid()),'manual_qr',normalized_utr,p_amount_inr,'pending',
    'wallet',nullif(left(coalesce(p_proof_url,''),2048),''),'Wallet deposit')
  returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.create_wallet_deposit_request(numeric,text,text) from public, anon;
grant execute on function public.create_wallet_deposit_request(numeric,text,text) to authenticated;

-- Atomic server-side charge. A failed/insufficient charge prevents the tool result
-- from being returned to the user. Admin accounts are exempt.
create or replace function public.consume_tool_wallet(p_tool_slug text)
returns numeric
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid()); p public.profiles%rowtype; t public.tools%rowtype; price numeric(10,2);
begin
  if uid is null then raise exception 'Sign in required'; end if;
  select * into p from public.profiles where id=uid for update;
  if not found or p.status <> 'active' then raise exception 'Account is not active'; end if;
  if p.role = 'admin' then return p.wallet_balance; end if;
  select * into t from public.tools where slug=p_tool_slug and enabled=true;
  if not found then raise exception 'Tool is unavailable'; end if;
  price := coalesce(t.price_inr,0);
  if price < 0 then raise exception 'Invalid tool price'; end if;
  if p.wallet_balance < price then raise exception 'Insufficient wallet balance. Please add funds.';
  end if;
  if price > 0 then
    update public.profiles set wallet_balance=wallet_balance-price,updated_at=now() where id=uid
      returning * into p;
    insert into public.wallet_transactions(user_id,amount_inr,balance_after,transaction_type,description)
      values(uid,-price,p.wallet_balance,'query_charge','Tool query: '||coalesce(t.name,p_tool_slug));
  end if;
  return p.wallet_balance;
end;
$$;
revoke all on function public.consume_tool_wallet(text) from public, anon;
grant execute on function public.consume_tool_wallet(text) to authenticated;

-- Replaces the old plan-only review routine. Wallet credits are issued exactly once
-- because only pending records can be approved and the row is locked.
create or replace function public.admin_review_payment(
  p_payment_id uuid,
  p_approve boolean,
  p_admin_note text default null
) returns void
language plpgsql security definer set search_path = ''
as $$
declare pay public.payment_records%rowtype; plan public.premium_plans%rowtype; new_balance numeric(12,2);
begin
  if (select auth.uid()) is null or not private.is_admin() then raise exception 'Admin access required'; end if;
  select * into pay from public.payment_records where id=p_payment_id for update;
  if not found then raise exception 'Payment not found'; end if;
  if pay.status <> 'pending' then raise exception 'Payment has already been reviewed'; end if;
  if p_approve then
    if pay.provider <> 'manual_qr' then raise exception 'Only manual QR payments can be reviewed here'; end if;
    if length(trim(coalesce(pay.provider_reference,''))) < 6 then raise exception 'Payment UTR/reference is missing'; end if;
    if pay.payment_type = 'wallet' then
      update public.profiles set wallet_balance=wallet_balance+pay.amount_inr,updated_at=now()
        where id=pay.user_id returning wallet_balance into new_balance;
      if not found then raise exception 'Payment user not found'; end if;
      insert into public.wallet_transactions(user_id,amount_inr,balance_after,transaction_type,reference_id,description)
        values(pay.user_id,pay.amount_inr,new_balance,'deposit',pay.id,'Admin-approved manual wallet deposit');
    else
      if pay.plan_id is null then raise exception 'Payment has no selected plan'; end if;
      select * into plan from public.premium_plans where id=pay.plan_id;
      if not found then raise exception 'Selected plan not found'; end if;
      if pay.amount_inr <> plan.price_inr then raise exception 'Submitted amount does not match the selected plan price'; end if;
      update public.profiles set credits=credits+plan.credits,plan_name=plan.name,
        plan_expires_at=greatest(coalesce(plan_expires_at,now()),now())+(plan.duration_days||' days')::interval,
        updated_at=now() where id=pay.user_id;
      if not found then raise exception 'Payment user not found'; end if;
      insert into public.credit_transactions(user_id,amount,delta,reason,created_by)
        values(pay.user_id,plan.credits,plan.credits,'Approved QR payment: '||plan.name,(select auth.uid()));
    end if;
    update public.payment_records set status='success',reviewed_by=(select auth.uid()),reviewed_at=now(),
      paid_at=now(),admin_note=nullif(left(coalesce(p_admin_note,''),500),'') where id=p_payment_id;
  else
    update public.payment_records set status='failed',reviewed_by=(select auth.uid()),reviewed_at=now(),
      admin_note=nullif(left(coalesce(p_admin_note,''),500),'') where id=p_payment_id;
  end if;
  insert into public.admin_audit_logs(actor_id,action,target_type,target_id,details)
    values((select auth.uid()),case when p_approve then 'payment.approved' else 'payment.rejected' end,
      'payment',p_payment_id::text,jsonb_build_object('user_id',pay.user_id,'amount_inr',pay.amount_inr,
      'payment_type',pay.payment_type,'note',p_admin_note));
end;
$$;
revoke all on function public.admin_review_payment(uuid,boolean,text) from public, anon;
grant execute on function public.admin_review_payment(uuid,boolean,text) to authenticated;

-- Disable the legacy Razorpay configuration so the manual-only flow is authoritative.
update public.payment_gateway_secrets set enabled=false where id='razorpay';
