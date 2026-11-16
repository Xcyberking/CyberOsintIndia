# CyberX OSINT

Mobile-first dark/neon-blue OSINT platform for ethical research and authorized security work.

## Implemented features
- Responsive landing page, tools directory, dark/light theme.
- Supabase email/password signup, login, logout, Google OAuth flow and password reset.
- User dashboard, profile, credit ledger, search history and referrals.
- Admin dashboard: user listing, credit adjustments, tool enable/disable and credit cost.
- Atomic tool credit deduction; admin accounts have unlimited tool credits.
- Admin settings: public contact links and announcement create/hide/delete.
- Provider environment-variable presence dashboard (never displays secret values).
- Public IP metadata lookup (approximate), DNS A/AAAA/MX/TXT/NS/CAA/SOA lookup.
- Email syntax and E.164 phone-format validation.
- Basic URL structure check (not a malware verdict).
- Privacy-filtered image metadata reader; GPS fields are intentionally excluded.
- PDF export.
- Daily Vercel Cron health probes for IP metadata and public DNS, stored in Supabase.
- GitHub Actions production build workflow.

## Deploy to Vercel
1. Import this repository into Vercel and select the Next.js framework.
2. In Vercel → Project → Settings → Environment Variables, set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` (your production site URL)
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only; required only for scheduled health history)
   - `CRON_SECRET` (random long secret; required for scheduled health history)
3. Never prefix the service-role key or CRON_SECRET with `NEXT_PUBLIC_`. Never place them in client-side code.
4. Run the Supabase SQL files in this order:
   - `supabase/schema.sql`
   - `supabase/referrals.sql`
   - `supabase/feature_expansion.sql`
   - Replace `YOUR_VERIFIED_EMAIL` in `supabase/ADMIN_SETUP.sql` with your verified account email and run it once.
5. In Supabase Auth → URL Configuration, set the production Site URL and add `https://YOUR-DOMAIN/auth/callback` to Redirect URLs.
6. For Google login, configure Google under Supabase Authentication → Providers and add the Supabase callback URL to Google Cloud OAuth client.
7. Redeploy the Vercel project after adding environment variables. Vercel Cron is configured in `vercel.json` to call `/api/cron/health` daily at 06:00 UTC.
8. After deployment, register, verify your email, and use the admin SQL setup to grant your account admin access.

## Vercel environment variable details
- Required for normal app/auth: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`.
- Required only for daily background health history: `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.
- Provider variables shown in Admin → Settings are informational placeholders only unless a provider integration is explicitly implemented. Adding a key does not automatically activate a provider.

## Limitations / not activated
- No payment gateway is connected. Payment processing requires a suitable provider, merchant verification and a reviewed checkout/webhook integration. Do not mark credits as paid based only on a browser redirect.
- Username discovery / cross-platform people search is not included; no private-account scraping or personal tracking.
- URL checker performs structure inspection only; it does not provide malware or reputation verdicts.
- Email/phone tools validate format only; they do not verify ownership, identify subscribers or locate people.
- IP lookup returns approximate network metadata, not a person's precise location.
- Vercel Cron history requires the two server-only environment variables and the SQL migration above. On a free Vercel plan, Cron scheduling is subject to the plan's supported schedule frequency.
- Google OAuth requires external Supabase/Google configuration.
- Image metadata supports user-uploaded images up to 10 MB and excludes GPS fields.

## Local development
Use Node.js 20+, install dependencies with `npm install`, copy `.env.example` to `.env.local`, then run `npm run dev`.

## Security
- Never expose service-role keys or provider secrets in client code.
- The included tools are restricted to public metadata, format validation and user-supplied files.
- Use only information you are authorized to access. No covert tracking, private-account access, credential harvesting or doxxing.
