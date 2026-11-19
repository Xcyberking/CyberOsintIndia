-- CyberOsintIndia production integration migration.
-- Additive only: preserves existing profiles, tools, credit transactions, search history,
-- settings, announcements and referral_claims rows.
-- Applied to project pwwwoppmhefscguajzwc on 2026-11-19.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter table public.profiles
  add column if not exists status text not null default 'active',
  add column if not exists updated_at timestamptz not null default now();
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user','moderator','admin'));
alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check check (status in ('active','suspended','banned'));

alter table public.credit_transactions
  add column if not exists delta integer,
  add column if not exists created_by uuid references auth.users(id) on delete set null;
update public.credit_transactions set delta=amount where delta is null;
alter table public.credit_transactions alter column delta set not null;

alter table public.referral_claims add column if not exists status text not null default 'qualified';
alter table public.referral_claims drop constraint if exists referral_claims_status_check;
alter table public.referral_claims add constraint referral_claims_status_check check (status in ('pending','qualified','rejected'));

alter table public.announcements
  add column if not exists is_published boolean not null default false,
  add column if not exists created_by uuid references auth.users(id) on delete set null;
update public.announcements set is_published=active where is_published is distinct from active;
alter table public.site_settings add column if not exists updated_by uuid references auth.users(id) on delete set null;

create table if not exists public.premium_plans (
  id uuid primary key default gen_random_uuid(), name text not null unique,
  description text not null default '', price_inr numeric(10,2) not null default 0 check(price_inr>=0),
  credits integer not null default 0 check(credits>=0), duration_days integer not null default 30 check(duration_days>0),
  is_active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.payment_records (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null,
  provider text not null default 'manual', provider_reference text,
  amount_inr numeric(10,2) not null default 0 check(amount_inr>=0),
  status text not null default 'pending' check(status in ('pending','success','failed','refunded')),
  created_at timestamptz not null default now()
);
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null,
  subject text not null, message text not null,
  status text not null default 'open' check(status in ('open','in_progress','closed')),
  admin_reply text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(), actor_id uuid references auth.users(id) on delete set null,
  action text not null, target_type text, target_id text, details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.api_integrations (
  id uuid primary key default gen_random_uuid(), name text not null unique, base_url text not null default '',
  description text not null default '', is_enabled boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.developer_resources (
  id uuid primary key default gen_random_uuid(), title text not null,
  resource_type text not null default 'documentation', url text not null default '',
  description text not null default '', is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.role='admin' and p.status='active');
$$;
revoke all on function private.is_admin() from public, anon;
grant usage on schema private to anon, authenticated;
grant execute on function private.is_admin() to anon, authenticated;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=''
as $$ select private.is_admin(); $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
revoke execute on function public.is_admin() from anon;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

alter table public.profiles enable row level security;
revoke all on public.profiles from anon;
revoke insert on public.profiles from authenticated;
revoke update on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update(display_name,bio,updated_at) on public.profiles to authenticated;

-- Use the existing tools table as the single source of truth.
alter table public.tools enable row level security;
drop policy if exists "admin tools delete" on public.tools;
drop policy if exists "admin tools insert" on public.tools;
drop policy if exists "admin tools update" on public.tools;
drop policy if exists "tools admin manage" on public.tools;
drop policy if exists "tools enabled read" on public.tools;
create policy "tools read enabled or admin" on public.tools for select to anon,authenticated
  using(enabled=true or (select private.is_admin()));
create policy "tools admin insert" on public.tools for insert to authenticated with check((select private.is_admin()));
create policy "tools admin update" on public.tools for update to authenticated
  using((select private.is_admin())) with check((select private.is_admin()));
create policy "tools admin delete" on public.tools for delete to authenticated using((select private.is_admin()));

alter table public.credit_transactions enable row level security;
drop policy if exists "credits own read" on public.credit_transactions;
drop policy if exists "credits admin read" on public.credit_transactions;
create policy "credits own or admin read" on public.credit_transactions for select to authenticated
  using(user_id=(select auth.uid()) or (select private.is_admin()));

alter table public.referral_claims enable row level security;
drop policy if exists "referrals own read" on public.referral_claims;
drop policy if exists "referrals admin manage" on public.referral_claims;
create policy "referrals own or admin read" on public.referral_claims for select to authenticated
  using(referrer_id=(select auth.uid()) or referred_id=(select auth.uid()) or (select private.is_admin()));
create policy "referrals admin insert" on public.referral_claims for insert to authenticated with check((select private.is_admin()));
create policy "referrals admin update" on public.referral_claims for update to authenticated
  using((select private.is_admin())) with check((select private.is_admin()));
create policy "referrals admin delete" on public.referral_claims for delete to authenticated using((select private.is_admin()));

do $$
declare t text;
begin
  foreach t in array array['premium_plans','payment_records','support_tickets','admin_audit_logs','api_integrations','developer_resources']
  loop execute format('alter table public.%I enable row level security',t); end loop;
end $$;

drop policy if exists "admins manage rows" on public.premium_plans;
drop policy if exists "public read active plans" on public.premium_plans;
create policy "plans read active or admin" on public.premium_plans for select to anon,authenticated
  using(is_active=true or (select private.is_admin()));
create policy "plans admin insert" on public.premium_plans for insert to authenticated with check((select private.is_admin()));
create policy "plans admin update" on public.premium_plans for update to authenticated
  using((select private.is_admin())) with check((select private.is_admin()));
create policy "plans admin delete" on public.premium_plans for delete to authenticated using((select private.is_admin()));

drop policy if exists "admins manage rows" on public.developer_resources;
drop policy if exists "public read published developer resources" on public.developer_resources;
create policy "developer resources read published or admin" on public.developer_resources for select to anon,authenticated
  using(is_published=true or (select private.is_admin()));
create policy "developer resources admin insert" on public.developer_resources for insert to authenticated with check((select private.is_admin()));
create policy "developer resources admin update" on public.developer_resources for update to authenticated
  using((select private.is_admin())) with check((select private.is_admin()));
create policy "developer resources admin delete" on public.developer_resources for delete to authenticated using((select private.is_admin()));

drop policy if exists "admins manage rows" on public.support_tickets;
drop policy if exists "support owner read" on public.support_tickets;
drop policy if exists "support owner insert" on public.support_tickets;
create policy "support owner or admin read" on public.support_tickets for select to authenticated
  using(user_id=(select auth.uid()) or (select private.is_admin()));
create policy "support owner or admin insert" on public.support_tickets for insert to authenticated
  with check(user_id=(select auth.uid()) or (select private.is_admin()));
create policy "support admin update" on public.support_tickets for update to authenticated
  using((select private.is_admin())) with check((select private.is_admin()));
create policy "support admin delete" on public.support_tickets for delete to authenticated using((select private.is_admin()));

drop policy if exists "announcements admin delete" on public.announcements;
drop policy if exists "announcements admin insert" on public.announcements;
drop policy if exists "announcements admin update" on public.announcements;
drop policy if exists "announcements admin manage" on public.announcements;
drop policy if exists "announcements read" on public.announcements;
create policy "announcements read published or admin" on public.announcements for select to anon,authenticated
  using(active=true or (select private.is_admin()));
create policy "announcements admin insert" on public.announcements for insert to authenticated with check((select private.is_admin()));
create policy "announcements admin update" on public.announcements for update to authenticated
  using((select private.is_admin())) with check((select private.is_admin()));
create policy "announcements admin delete" on public.announcements for delete to authenticated using((select private.is_admin()));

drop policy if exists "settings read" on public.site_settings;
drop policy if exists "public can read settings" on public.site_settings;
drop policy if exists "settings admin read" on public.site_settings;
create policy "settings admin read" on public.site_settings for select to authenticated using((select private.is_admin()));

grant select,insert,update,delete on public.tools,public.premium_plans,public.payment_records,
  public.credit_transactions,public.referral_claims,public.site_settings,public.announcements,
  public.support_tickets,public.admin_audit_logs,public.api_integrations,public.developer_resources
  to authenticated;
grant select on public.tools,public.premium_plans,public.announcements,public.developer_resources to anon,authenticated;
grant insert on public.support_tickets to authenticated;

create or replace function public.admin_update_user(
  target_user_id uuid,new_role text default null,new_status text default null,
  credit_delta integer default 0,credit_reason text default 'Admin adjustment'
)
returns void language plpgsql security definer set search_path=''
as $$
declare current_credits integer;
begin
  if (select auth.uid()) is null or not private.is_admin() then raise exception 'Admin access required'; end if;
  if new_role is not null and new_role not in ('user','moderator','admin') then raise exception 'Invalid role'; end if;
  if new_status is not null and new_status not in ('active','suspended','banned') then raise exception 'Invalid status'; end if;
  if credit_delta<>0 then
    select credits into current_credits from public.profiles where id=target_user_id for update;
    if not found then raise exception 'User not found'; end if;
    if current_credits+credit_delta<0 then raise exception 'Insufficient credits'; end if;
    update public.profiles set credits=credits+credit_delta,updated_at=now() where id=target_user_id;
    insert into public.credit_transactions(user_id,amount,delta,reason,created_by)
      values(target_user_id,credit_delta,credit_delta,left(credit_reason,180),(select auth.uid()));
  end if;
  update public.profiles set role=coalesce(new_role,role),status=coalesce(new_status,status),updated_at=now()
    where id=target_user_id;
  if not found then raise exception 'User not found'; end if;
  insert into public.admin_audit_logs(actor_id,action,target_type,target_id,details)
    values((select auth.uid()),'user.updated','profile',target_user_id::text,
      jsonb_build_object('role',new_role,'status',new_status,'credit_delta',credit_delta));
end;
$$;
revoke all on function public.admin_update_user(uuid,text,text,integer,text) from public,anon;
grant execute on function public.admin_update_user(uuid,text,text,integer,text) to authenticated;

create index if not exists admin_audit_logs_actor_id_idx on public.admin_audit_logs(actor_id);
create index if not exists announcements_created_by_idx on public.announcements(created_by);
create index if not exists credit_transactions_created_by_idx on public.credit_transactions(created_by);
create index if not exists payment_records_user_id_idx on public.payment_records(user_id);
create index if not exists site_settings_updated_by_idx on public.site_settings(updated_by);
create index if not exists support_tickets_user_id_idx on public.support_tickets(user_id);

insert into public.premium_plans(name,description,price_inr,credits,duration_days,is_active)
values
 ('Basic','Starter plan example. Configure a verified payment provider before taking payments.',29,10,30,true),
 ('Pro','Extended plan example. Configure a verified payment provider before taking payments.',49,25,30,true),
 ('Ultra','Higher usage plan example. Configure a verified payment provider before taking payments.',99,50,30,true)
on conflict(name) do nothing;


-- Signed-in users can clear only their own saved search history.
alter table public.search_history enable row level security;
drop policy if exists "history own delete" on public.search_history;
create policy "history own delete" on public.search_history
  for delete to authenticated using ((select auth.uid()) = user_id);
grant delete on public.search_history to authenticated;
