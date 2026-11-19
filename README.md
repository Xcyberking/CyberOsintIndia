# CyberX OSINT

Android-first public-source research workspace built with Next.js 15, React 19 and Supabase.

## User application
- Responsive mobile UI with dashboard, tools directory, history, profile and settings.
- Public IP metadata lookup and public RDAP domain registration lookup.
- Email syntax validation, URL structure inspection and direct links to public profile pages.
- PWA manifest and app icon.
- Optional Supabase Auth.

## Admin control center
Open `/admin` after deployment. The panel includes:
- Dashboard and database-backed count cards.
- User roles, account status and credit adjustments.
- Banned/suspended user review.
- Tool enable/disable controls.
- Premium plan creation and activation controls.
- Payment record review and status updates (manual records only; no payment gateway is included).
- Credit transaction history and referral review.
- Site settings and appearance configuration.
- Announcements, public API endpoint settings and developer resources.
- Support ticket status, audit logs, analytics counts, system information and backup guidance.

Admin access is enforced using Supabase Auth, a database role check and Row Level Security. A normal user cannot promote their own account through the app.

## Setup
1. Use Node.js 22 or newer.
2. Copy `.env.example` to `.env.local`.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key is preferred).
4. In the Supabase SQL Editor, run `supabase/schema.sql`, then `supabase/admin-suite.sql`.
5. Create your owner account through Supabase Auth / the app.
6. In the SQL Editor, replace the email below with your verified owner email and run:

```sql
update public.profiles p
set role = 'admin'
from auth.users u
where p.id = u.id
  and u.email = 'YOUR_VERIFIED_ADMIN_EMAIL';
```

7. Sign in at `https://YOUR_DOMAIN/admin` using that account.

## Run locally
```bash
npm install
npm run dev
``

Open http://localhost:3000.

## Deploy
Import the repository into Vercel or another Node.js host. Build command: `npm run build`; start command: `npm start`. Set the two Supabase environment variables in the hosting dashboard and redeploy.

## Important configuration notes
- Run the SQL files in the order listed above. The admin panel remains locked until the database schema and an admin role are configured.
- Do not put Supabase service-role or secret keys in `NEXT_PUBLIC_*` variables or browser code.
- Public API integrations store endpoint URLs only; never paste private API keys into the public settings table.
- Payment records are administrative records only. A real payment provider and verified webhook are required before accepting live payments.
- Backup & Restore links to the Supabase backup workflow; the browser admin panel does not pretend to create database snapshots.
- The app currently stores search history in browser memory only.

## Privacy and safety
This project is scoped to lawful research using public, non-sensitive technical information. It does not provide private-person tracking, account intrusion, password discovery, leaked personal-data dumps, or phone-number identity lookup. IP lookups are approximate network metadata and must not be treated as a person's precise location.
