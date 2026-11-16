# CyberX OSINT

Next.js 15 + Supabase. Blue/white UI, admin-managed tools. Only tools you add in the admin panel are shown to users.

## Setup

1. Create a Supabase project and run `supabase/setup.sql` in the SQL Editor (once).
2. Auth > Providers > Email: turn **Confirm email** off for instant sign-up (or configure custom SMTP, the built-in mailer is heavily rate limited).
3. Auth > URL Configuration: set Site URL to your domain and add `https://YOUR-DOMAIN/auth/callback` to Redirect URLs.
4. Copy `.env.example` to `.env.local` and fill the values.
5. Register, then run `supabase/ADMIN_SETUP.sql` with your email to become admin.

## Environment variables

| Name | Where |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` | public |
| `SUPABASE_SERVICE_ROLE_KEY` | server only, required for tool APIs and refunds |
| `CRON_SECRET` | server only, protects the daily health cron |

## Admin panel

`/admin` has a fixed bottom bar with every section: Overview, Users, Tools, Activity, Referrals, Settings, Health.
In **Tools** you can add, edit, hide/show and delete tools. Put `{}` in the API URL where the user input goes. Secrets belong in Vercel env vars, referenced as `{{env:NAME}}` in headers.

## Deploy

Import the repo in Vercel, add the env vars above, deploy. `vercel.json` pins functions to Mumbai (`bom1`) to sit next to a Mumbai Supabase project.

## Use responsibly

For lawful research of public information and authorized security work only.
