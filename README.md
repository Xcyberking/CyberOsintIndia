# CyberX OSINT

Mobile-first dark/neon-blue OSINT platform for ethical research and authorized security work.

## Features implemented in the repository
- Responsive CyberX landing page, tools directory, dark/light theme toggle.
- Supabase email/password signup, login, logout and auth callback.
- User dashboard, profile page, credit ledger and recent search history.
- Admin-only dashboard with user listing, credit adjustments and tool enable/disable/price controls.
- Atomic credit deduction through a database function; admins have unlimited tool credits.
- Referral codes, verified-email referral claim workflow and reward ledger.
- Admin health/configuration status endpoint and UI.
- Working public IP metadata, DNS A/AAAA resolution, email syntax check, E.164 phone-format check, basic URL structure check.
- Image metadata reader for user-provided images; GPS/location fields are intentionally excluded.
- PDF export for lookup results.
- GitHub Actions build workflow.

## Setup
1. Use Node.js 20+ and run `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SITE_URL`.
4. Run `supabase/schema.sql` in the Supabase SQL Editor.
5. Then run `supabase/referrals.sql` to enable referral codes and add the image metadata tool.
6. Register your account and confirm its email.
7. Replace `YOUR_VERIFIED_EMAIL` in `supabase/ADMIN_SETUP.sql` with your verified account email and run that SQL once.
8. In Supabase Auth, set the site URL and add `/auth/callback` to allowed redirect URLs.
9. Run `npm run dev`.

## Tool behavior and limitations
- IP lookup uses the public ipwho.is service and returns approximate network/geolocation metadata, not a person's precise location.
- Domain/DNS lookup resolves public A/AAAA records via the server DNS resolver.
- Email and phone tools validate syntax/format only. They do not confirm inbox ownership, identify subscribers or locate people.
- URL Safety Check validates URL structure only; it is not a malware/reputation verdict.
- Image metadata accepts user-uploaded files up to 10 MB and deliberately excludes GPS fields.
- Username search and advanced social-profile discovery are not enabled.
- PDF export contains the current tool result.
- Health monitor reports configuration presence; it is not a continuous uptime probe.
- Google OAuth, payments, custom API-provider editor, advanced DNS record types and full username discovery require separate provider configuration/integration and are not claimed as live.

## Security
- Never expose service-role keys or provider secrets in client code.
- The included tools are restricted to public metadata, format validation and user-supplied files.
- Use only information you are authorized to access. No covert tracking, private-account access, credential harvesting or doxxing.
