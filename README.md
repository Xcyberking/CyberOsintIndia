# CyberX OSINT

Android-first public-source research workspace built with Next.js 15, React 19 and Supabase.

## User application
- Responsive mobile UI with dashboard, tools directory, history, profile and settings.
- Public IP metadata lookup, public RDAP domain registration lookup and live DNS-over-HTTPS records (A, AAAA, MX, NS, TXT).
- Email syntax and MX-record validation, URL/HTTPS structure inspection and public profile-link discovery.
- Reverse-image search handoff to established search providers, social-profile link builder and official self-service breach-check handoff.
- Login, registration, password reset, profile editing, optional Google/GitHub OAuth entry points, history sync and logout.
- PWA manifest and app icon.
- Supabase Auth with persistent sessions and per-user search history.

## Admin control center
Open `/admin` after deployment. The panel includes:
- Dashboard and database-backed count cards.
- User roles, account status and credit adjustments.
- Banned/suspended user review.
- Tool enable/disable controls for implemented tools. The user directory reads the enabled flags from Supabase.
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
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The CyberOsintIndia project values are prefilled in `.env.example`.
4. The connected CyberOsintIndia database has already received the additive integration migrations. The applied SQL is documented in [`supabase/cyberosintindia-integration.sql`](supabase/cyberosintindia-integration.sql). Do not rerun it against the already-migrated live project; it is included for review and reproducible setup.
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
Import the repository into Vercel or another Node.js host. Build command: `npm run build`; start command: `npm start`. Set the two Supabase publishable environment variables in the hosting dashboard and redeploy.

## Important configuration notes
- Run the SQL files in the order listed above. The admin panel remains locked until the database schema and an admin role are configured.
- Do not put Supabase service-role or secret keys in `NEXT_PUBLIC_*` variables or browser code.
- Public API integrations store endpoint URLs only; never paste private API keys into the public settings table.
- The current public tool registry and its safe activation defaults are documented in [`supabase/active-public-tools.sql`](supabase/active-public-tools.sql). The live Supabase project has already been updated; do not rerun unless intentionally reapplying the tool registry.
- Google and GitHub OAuth buttons require those providers to be configured in Supabase Auth.
- Reverse-image search opens third-party search providers; it does not upload or store user images.
- Breach self-check opens the official Have I Been Pwned service; CyberX does not submit email addresses to breach databases.
- Payment records are administrative records only. A real payment provider and verified webhook are required before accepting live payments.
- Backup & Restore links to the Supabase backup workflow; the browser admin panel does not pretend to create database snapshots.
- Signed-in users have search history saved to their own Supabase account; guest activity remains local to the current browser session.

## Privacy and safety
This project is scoped to lawful research using public, non-sensitive technical information. It does not provide private-person tracking, account intrusion, password discovery, leaked personal-data dumps, or phone-number identity lookup. IP lookups are approximate network metadata and must not be treated as a person's precise location.


## Google and GitHub OAuth setup

The application now uses a shared PKCE callback at `/auth/callback` for both the public sign-in page and the admin sign-in page. The admin callback checks the signed-in user's `profiles.role` and `profiles.status` in PostgreSQL; an OAuth identity alone never grants administrator access.

Configure these providers in Supabase Dashboard → Authentication → Sign In / Providers:

- Google: enable Google and enter the Google OAuth Web Client ID and Client Secret.
- GitHub: enable GitHub and enter the GitHub OAuth App Client ID and Client Secret.

For each provider's OAuth application, use the Supabase provider callback URL shown in the Supabase provider settings as its authorized redirect/callback URL. In Supabase Dashboard → Authentication → URL Configuration, add the deployed app origin as the Site URL and allow `https://YOUR-DEPLOYED-DOMAIN/auth/callback` (plus the local callback URL only while developing).

Google OAuth Web Client: add the deployed app origin to Authorized JavaScript origins; add the Supabase provider callback URL to Authorized redirect URIs. GitHub OAuth App: set the app homepage to the deployed app origin and Authorization callback URL to the Supabase provider callback URL.

The admin account must already have `role='admin'` and `status='active'` in `public.profiles`. Do not promote users based on email text, provider name, or user-editable metadata. Keep OAuth client secrets only in the Supabase provider settings, never in `NEXT_PUBLIC_*` variables or browser code.
