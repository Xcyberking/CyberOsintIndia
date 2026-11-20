-- Manual QR payment review, support workflow, and audited admin credit/plan tools.
alter table public.payment_records add column if not exists admin_note text;

create unique index if not exists payment_records_manual_utr_unique
  on public.payment_records (lower(trim(provider_reference)))
  where provider='manual_qr' and provider_reference is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='payment_records_manual_utr_required'
      and conrelid='public.payment_records'::regclass
  ) then
    alter table public.payment_records
      add constraint payment_records_manual_utr_required
      check (provider <> 'manual_qr' or (provider_reference is not null and length(trim(provider_reference)) between 6 and 80)) not valid;
  end if;
end $$;

create or replace function public.admin_review_payment(
  p_payment_id uuid,
  p_approve boolean,
  p_admin_note text default null
) returns void
language plpgsql security definer set search_path = ''
as $$
declare p public.payment_records%rowtype; plan public.premium_plans%rowtype;
begin
  if (select auth.uid()) is null or not private.is_admin() then raise exception 'Admin access required'; end if;
  select * into p from public.payment_records where id=p_payment_id for update;
  if not found then raise exception 'Payment not found'; end if;
  if p.status <> 'pending' then raise exception 'Payment has already been reviewed'; end if;

  if p_approve then
    if p.provider <> 'manual_qr' then raise exception 'Only manual QR payments can be reviewed here'; end if;
    if coalesce(trim(p.provider_reference),'') = '' then raise exception 'Payment UTR/reference is missing'; end if;
    if p.plan_id is null then raise exception 'Payment has no selected plan'; end if;
    select * into plan from public.premium_plans where id=p.plan_id;
    if not found then raise exception 'Selected plan not found'; end if;
    if p.amount_inr <> plan.price_inr then raise exception 'Submitted amount does not match the selected plan price'; end if;

    update public.profiles
      set credits=credits+plan.credits, plan_name=plan.name,
          plan_expires_at=greatest(coalesce(plan_expires_at,now()),now())+(plan.duration_days||' days')::interval,
          updated_at=now()
      where id=p.user_id;
    if not found then raise exception 'Payment user not found'; end if;
    insert into public.credit_transactions(user_id,amount,delta,reason,created_by)
      values(p.user_id,plan.credits,plan.credits,'Approved QR payment: '||plan.name,(select auth.uid()));
    update public.payment_records set status='success',reviewed_by=(select auth.uid()),reviewed_at=now(),
      paid_at=now(),admin_note=nullif(left(coalesce(p_admin_note,''),500),'') where id=p_payment_id;
  else
    update public.payment_records set status='failed',reviewed_by=(select auth.uid()),reviewed_at=now(),
      admin_note=nullif(left(coalesce(p_admin_note,''),500),'') where id=p_payment_id;
  end if;

  insert into public.admin_audit_logs(actor_id,action,target_type,target_id,details)
    values((select auth.uid()),case when p_approve then 'payment.approved' else 'payment.rejected' end,
      'payment',p_payment_id::text,jsonb_build_object('user_id',p.user_id,'amount_inr',p.amount_inr,'note',p_admin_note));
end;
$$;

create or replace function public.admin_bulk_grant_credits(
  p_credit_delta integer,
  p_reason text default 'Administrator credit grant',
  p_target_user_id uuid default null
) returns integer
language plpgsql security definer set search_path = ''
as $$
declare affected integer := 0; target record;
begin
  if (select auth.uid()) is null or not private.is_admin() then raise exception 'Admin access required'; end if;
  if p_credit_delta = 0 or abs(p_credit_delta) > 100000 then raise exception 'Credit amount must be between -100000 and 100000 and not zero'; end if;
  for target in
    select id,credits from public.profiles
    where role='user' and status='active' and (p_target_user_id is null or id=p_target_user_id)
    order by id for update
  loop
    if target.credits + p_credit_delta < 0 then
      if p_target_user_id is not null then raise exception 'This user does not have enough credits'; end if;
      continue;
    end if;
    update public.profiles set credits=credits+p_credit_delta,updated_at=now() where id=target.id;
    insert into public.credit_transactions(user_id,amount,delta,reason,created_by)
      values(target.id,abs(p_credit_delta),p_credit_delta,left(coalesce(nullif(trim(p_reason),''),'Administrator credit grant'),180),(select auth.uid()));
    affected:=affected+1;
  end loop;
  insert into public.admin_audit_logs(actor_id,action,target_type,target_id,details)
    values((select auth.uid()),'credits.bulk_grant','profiles',coalesce(p_target_user_id::text,'ALL_ACTIVE_USERS'),
      jsonb_build_object('delta',p_credit_delta,'reason',p_reason,'users_updated',affected));
  return affected;
end;
$$;

create or replace function public.admin_assign_plan(
  p_target_user_id uuid,
  p_plan_id uuid,
  p_add_credits boolean default true
) returns void
language plpgsql security definer set search_path = ''
as $$
declare plan public.premium_plans%rowtype;
begin
  if (select auth.uid()) is null or not private.is_admin() then raise exception 'Admin access required'; end if;
  select * into plan from public.premium_plans where id=p_plan_id;
  if not found then raise exception 'Plan not found'; end if;
  update public.profiles set plan_name=plan.name,
    plan_expires_at=greatest(coalesce(plan_expires_at,now()),now())+(plan.duration_days||' days')::interval,
    credits=credits+case when p_add_credits then plan.credits else 0 end,updated_at=now()
    where id=p_target_user_id;
  if not found then raise exception 'User not found'; end if;
  if p_add_credits then
    insert into public.credit_transactions(user_id,amount,delta,reason,created_by)
      values(p_target_user_id,plan.credits,plan.credits,'Admin assigned plan: '||plan.name,(select auth.uid()));
  end if;
  insert into public.admin_audit_logs(actor_id,action,target_type,target_id,details)
    values((select auth.uid()),'plan.assigned','profile',p_target_user_id::text,
      jsonb_build_object('plan_id',p_plan_id,'plan_name',plan.name,'credits_added',p_add_credits));
end;
$$;

revoke all on function public.admin_review_payment(uuid,boolean,text) from public,anon;
grant execute on function public.admin_review_payment(uuid,boolean,text) to authenticated;
revoke all on function public.admin_bulk_grant_credits(integer,text,uuid) from public,anon;
grant execute on function public.admin_bulk_grant_credits(integer,text,uuid) to authenticated;
revoke all on function public.admin_assign_plan(uuid,uuid,boolean) from public,anon;
grant execute on function public.admin_assign_plan(uuid,uuid,boolean) to authenticated;
