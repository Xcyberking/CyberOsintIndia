-- Run after schema.sql and referrals.sql.
create table if not exists public.health_checks (
 id uuid primary key default gen_random_uuid(),
 service text not null,
 status text not null check(status in ('online','degraded','offline')),
 latency_ms integer,
 details text not null default '',
 checked_at timestamptz not null default now()
);
alter table public.health_checks enable row level security;
drop policy if exists "admins read health checks" on public.health_checks;
create policy "admins read health checks" on public.health_checks for select to authenticated using(public.is_admin());
create index if not exists health_checks_checked_at_idx on public.health_checks(checked_at desc);
create index if not exists announcements_created_at_idx on public.announcements(created_at desc);
insert into public.site_settings(key,value) values
 ('contact', '{"email":"","telegram":"","whatsapp":"","github":"https://github.com/Xcyberking/CyberOsintIndia","instagram":"","youtube":""}'::jsonb),
 ('credit_packages', '[{"name":"Starter","credits":10,"price_inr":30,"enabled":false},{"name":"Standard","credits":20,"price_inr":50,"enabled":false}]'::jsonb)
on conflict(key) do nothing;
