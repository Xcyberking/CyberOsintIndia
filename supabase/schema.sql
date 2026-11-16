create extension if not exists pgcrypto;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text,
 display_name text,
 role text not null default 'user' check (role in ('user','admin')),
 credits integer not null default 5 check (credits >= 0),
 created_at timestamptz not null default now()
);
create table if not exists public.tools (
 id uuid primary key default gen_random_uuid(),
 slug text unique not null,
 name text not null,
 description text not null default '',
 category text not null default 'General',
 credit_cost integer not null default 1 check (credit_cost >= 0),
 enabled boolean not null default true,
 provider_key text,
 created_at timestamptz not null default now()
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
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin'); $$;
alter table public.profiles enable row level security;
alter table public.tools enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.search_history enable row level security;
alter table public.site_settings enable row level security;
alter table public.announcements enable row level security;
create policy "profiles read own or admin" on public.profiles for select using (auth.uid()=id or public.is_admin());
create policy "tools enabled read" on public.tools for select using (enabled or public.is_admin());
create policy "admin tools manage" on public.tools for all using (public.is_admin()) with check (public.is_admin());
create policy "credits own read" on public.credit_transactions for select using (auth.uid()=user_id or public.is_admin());
create policy "history own read" on public.search_history for select using (auth.uid()=user_id or public.is_admin());
create policy "history own insert" on public.search_history for insert with check (auth.uid()=user_id);
create policy "settings public read" on public.site_settings for select using (true);
create policy "settings admin manage" on public.site_settings for all using (public.is_admin()) with check (public.is_admin());
create policy "announcements read" on public.announcements for select using (active or public.is_admin());
create policy "announcements admin manage" on public.announcements for all using (public.is_admin()) with check (public.is_admin());
