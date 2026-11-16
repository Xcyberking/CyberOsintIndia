create extension if not exists pgcrypto;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text, display_name text,
 role text not null default 'user' check(role in ('user','admin')),
 credits integer not null default 5 check(credits>=0),
 created_at timestamptz not null default now()
);
create table if not exists public.tools (
 id uuid primary key default gen_random_uuid(), slug text unique not null,
 name text not null, description text not null default '',
 category text not null default 'General',
 credit_cost integer not null default 1 check(credit_cost>=0),
 enabled boolean not null default true, provider_key text,
 created_at timestamptz not null default now()
);
create table if not exists public.credit_transactions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 amount integer not null, reason text not null, created_at timestamptz not null default now()
);
create table if not exists public.search_history (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 tool_slug text not null, input_summary text not null,
 status text not null default 'success', created_at timestamptz not null default now()
);
create table if not exists public.site_settings (
 key text primary key, value jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);
create table if not exists public.announcements (
 id uuid primary key default gen_random_uuid(), title text not null,
 body text not null, active boolean not null default true,
 created_at timestamptz not null default now()
);
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin'); $$;
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public
as $$ begin
 insert into public.profiles(id,email,display_name,credits)
 values(new.id,new.email,coalesce(new.raw_user_meta_data->>'display_name',''),5)
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
 if public.is_admin() then return jsonb_build_object('charged',0,'balance',null,'admin_unlimited',true); end if;
 update public.profiles set credits=credits-v_cost where id=auth.uid() and credits>=v_cost returning credits into v_balance;
 if not found then raise exception 'Insufficient credits'; end if;
 insert into public.credit_transactions(user_id,amount,reason) values(auth.uid(),-v_cost,'Tool usage: '||p_tool_slug);
 return jsonb_build_object('charged',v_cost,'balance',v_balance,'admin_unlimited',false);
end; $$;
create or replace function public.admin_adjust_credits(p_user_id uuid,p_amount integer,p_reason text) returns integer
language plpgsql security definer set search_path=public
as $$ declare v_balance integer;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 if p_amount=0 or abs(p_amount)>10000 then raise exception 'Invalid credit adjustment'; end if;
 update public.profiles set credits=greatest(0,credits+p_amount) where id=p_user_id returning credits into v_balance;
 if not found then raise exception 'User not found'; end if;
 insert into public.credit_transactions(user_id,amount,reason) values(p_user_id,p_amount,left(p_reason,160));
 return v_balance;
end; $$;
alter table public.profiles enable row level security;
alter table public.tools enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.search_history enable row level security;
alter table public.site_settings enable row level security;
alter table public.announcements enable row level security;
drop policy if exists "profiles read own or admin" on public.profiles;
create policy "profiles read own or admin" on public.profiles for select using(auth.uid()=id or public.is_admin());
drop policy if exists "tools enabled read" on public.tools;
create policy "tools enabled read" on public.tools for select using(enabled or public.is_admin());
drop policy if exists "admin tools manage" on public.tools;
create policy "admin tools manage" on public.tools for all using(public.is_admin()) with check(public.is_admin());
drop policy if exists "credits own read" on public.credit_transactions;
create policy "credits own read" on public.credit_transactions for select using(auth.uid()=user_id or public.is_admin());
drop policy if exists "history own read" on public.search_history;
create policy "history own read" on public.search_history for select using(auth.uid()=user_id or public.is_admin());
drop policy if exists "history own insert" on public.search_history;
create policy "history own insert" on public.search_history for insert with check(auth.uid()=user_id);
drop policy if exists "settings read" on public.site_settings;
create policy "settings read" on public.site_settings for select using(true);
drop policy if exists "settings admin manage" on public.site_settings;
create policy "settings admin manage" on public.site_settings for all using(public.is_admin()) with check(public.is_admin());
drop policy if exists "announcements read" on public.announcements;
create policy "announcements read" on public.announcements for select using(active or public.is_admin());
drop policy if exists "announcements admin manage" on public.announcements;
create policy "announcements admin manage" on public.announcements for all using(public.is_admin()) with check(public.is_admin());
grant execute on function public.consume_tool_credit(text) to authenticated;
grant execute on function public.admin_adjust_credits(uuid,integer,text) to authenticated;
insert into public.tools(slug,name,description,category,credit_cost,enabled) values
('ip-lookup','IP Lookup','Public IP geolocation metadata','Network',1,true),
('domain-lookup','Domain Lookup','Public domain DNS address lookup','Domain',1,true),
('dns-lookup','DNS Lookup','Public DNS resolution','Domain',1,true),
('email-validator','Email Validator','Email syntax validation','Identity',1,true),
('phone-validator','Phone Validator','International phone format validation','Identity',1,true),
('url-safety','URL Safety Check','Basic URL structure inspection','Security',1,true)
on conflict(slug) do nothing;
