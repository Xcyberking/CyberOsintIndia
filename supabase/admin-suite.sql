-- CyberX OSINT admin suite schema (safe to run after the initial schema.sql).
-- All exposed tables use RLS. Admin authority comes from profiles.role, never user-editable metadata.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter table public.profiles
  add column if not exists role text not null default 'user',
  add column if not exists credits integer not null default 0,
  add column if not exists status text not null default 'active';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user','moderator','admin'));
alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check check (status in ('active','suspended','banned'));
alter table public.profiles drop constraint if exists profiles_credits_check;
alter table public.profiles add constraint profiles_credits_check check (credits >= 0);

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin' and p.status = 'active'
  );
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

-- User profile data: users can read/update only their own safe profile fields.
drop policy if exists "Users can read their own profile" on public.profiles;
drop policy if exists "Users can create their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Users can read their own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Admins can read all profiles" on public.profiles
  for select to authenticated using ((select private.is_admin()));
create policy "Users can create their own profile" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id and role = 'user');
create policy "Users can update their own safe profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
revoke update on public.profiles from authenticated;
grant update (username, display_name, updated_at) on public.profiles to authenticated;

create table if not exists public.tool_registry (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  category text not null default 'Research',
  is_enabled boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.premium_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  price_inr numeric(10,2) not null default 0 check (price_inr >= 0),
  credits integer not null default 0 check (credits >= 0),
  duration_days integer not null default 30 check (duration_days > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.payment_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  provider text not null default 'manual',
  provider_reference text,
  amount_inr numeric(10,2) not null default 0 check (amount_inr >= 0),
  status text not null default 'pending' check (status in ('pending','success','failed','refunded')),
  created_at timestamptz not null default now()
);
create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.referral_records (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid references auth.users(id) on delete set null,
  referred_user_id uuid references auth.users(id) on delete set null,
  reward_credits integer not null default 0 check (reward_credits >= 0),
  status text not null default 'pending' check (status in ('pending','qualified','rejected')),
  created_at timestamptz not null default now()
);
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  is_published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open','in_progress','closed')),
  admin_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.api_integrations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  base_url text not null default '',
  description text not null default '',
  is_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.developer_resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  resource_type text not null default 'documentation',
  url text not null default '',
  description text not null default '',
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

-- Enable RLS on every table in the exposed public schema.
do $$
declare t text;
begin
  foreach t in array array['tool_registry','premium_plans','payment_records','credit_transactions','referral_records','site_settings','announcements','support_tickets','admin_audit_logs','api_integrations','developer_resources']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Admins manage all rows" on public.%I', t);
    execute format('create policy "Admins manage all rows" on public.%I for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t);
  end loop;
end $$;

drop policy if exists "Public can view enabled tools" on public.tool_registry;
create policy "Public can view enabled tools" on public.tool_registry
  for select to anon, authenticated using (is_enabled = true);
drop policy if exists "Public can view active plans" on public.premium_plans;
create policy "Public can view active plans" on public.premium_plans
  for select to anon, authenticated using (is_active = true);
drop policy if exists "Public can view published announcements" on public.announcements;
create policy "Public can view published announcements" on public.announcements
  for select to anon, authenticated using (is_published = true);

drop policy if exists "Users can read own support tickets" on public.support_tickets;
create policy "Users can read own support tickets" on public.support_tickets
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Users can create own support tickets" on public.support_tickets;
create policy "Users can create own support tickets" on public.support_tickets
  for insert to authenticated with check (user_id = (select auth.uid()));

grant select on public.tool_registry, public.premium_plans, public.announcements to anon, authenticated;
grant select, insert, update, delete on public.tool_registry, public.premium_plans, public.payment_records,
  public.credit_transactions, public.referral_records, public.site_settings, public.announcements,
  public.support_tickets, public.admin_audit_logs, public.api_integrations, public.developer_resources to authenticated;
grant select, insert on public.support_tickets to authenticated;
grant select, insert on public.credit_transactions to authenticated;

-- Privileged user action: callable only by authenticated active admins.
create or replace function public.admin_update_user(
  target_user_id uuid,
  new_role text default null,
  new_status text default null,
  credit_delta integer default 0,
  credit_reason text default 'Admin adjustment'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare current_credits integer;
begin
  if (select auth.uid()) is null or not private.is_admin() then
    raise exception 'Admin access required';
  end if;
  if new_role is not null and new_role not in ('user','moderator','admin') then
    raise exception 'Invalid role';
  end if;
  if new_status is not null and new_status not in ('active','suspended','banned') then
    raise exception 'Invalid status';
  end if;
  if credit_delta <> 0 then
    select credits into current_credits from public.profiles where id = target_user_id for update;
    if not found then raise exception 'User not found'; end if;
    if current_credits + credit_delta < 0 then raise exception 'Insufficient credits'; end if;
    update public.profiles set credits = credits + credit_delta, updated_at = now() where id = target_user_id;
    insert into public.credit_transactions(user_id, delta, reason, created_by)
      values (target_user_id, credit_delta, left(credit_reason, 180), (select auth.uid()));
  end if;
  update public.profiles
    set role = coalesce(new_role, role),
        status = coalesce(new_status, status),
        updated_at = now()
    where id = target_user_id;
  if not found then raise exception 'User not found'; end if;
  insert into public.admin_audit_logs(actor_id, action, target_type, target_id, details)
    values ((select auth.uid()), 'user.updated', 'profile', target_user_id::text,
      jsonb_build_object('role',new_role,'status',new_status,'credit_delta',credit_delta));
end;
$$;
revoke all on function public.admin_update_user(uuid,text,text,integer,text) from public, anon;
grant execute on function public.admin_update_user(uuid,text,text,integer,text) to authenticated;

-- First admin: replace the email with the owner's verified Supabase Auth email and run once.
-- update public.profiles p set role='admin'
-- from auth.users u where p.id=u.id and u.email='YOUR_VERIFIED_ADMIN_EMAIL';
