# CyberX OSINT: Firebase Auth + Supabase Tools/Images

This project keeps Firebase Authentication and Firebase user profiles/wallet data. The CyberOsintIndia Supabase project stores:

- `public.tools` — administrator-managed tool catalogue
- `public.site_settings` — public payment/site settings
- `cyberx-site-media` — public site images and payment QR codes
- `cyberx-avatars` — private user avatars
- `cyberx-user-media` — private payment proof images

Supabase project:

- Project ref: `pwwwoppmhefscguajzwc`
- URL: `https://pwwwoppmhefscguajzwc.supabase.co`
- Region: `ap-south-1`

## Vercel environment variables

The application uses these Supabase server variables:

- `SUPABASE_URL`: the project URL above. The source code has the same default, but set it explicitly in Vercel for all environments.
- `SUPABASE_SERVICE_ROLE_KEY`: required server-only secret/service-role key. Add it to Production, Preview, and Development.

Never prefix the service-role/secret key with `NEXT_PUBLIC_`, put it in browser code, or commit it to GitHub. The server uses it only after verifying the caller's Firebase ID token and, for writes/uploads, the Firebase admin custom claim.

Firebase login continues to use the existing `NEXT_PUBLIC_FIREBASE_*` variables and server-side `FIREBASE_SERVICE_ACCOUNT_JSON`.

## Authorization model

- Browser login/register/Google login remains Firebase Authentication.
- Next.js API routes verify Firebase ID tokens.
- Tool and payment-setting writes require a Firebase admin claim.
- Public tool reads are restricted to enabled tools by the API route and RLS.
- Public site-setting reads are restricted to approved payment/reward keys.
- The Supabase service-role key is never sent to the browser.
- User media paths are scoped to the Firebase UID; site-media upload is admin-only.

## Database and Storage setup

The existing `CyberOsintIndia` database already has the required `tools` and `site_settings` tables, with RLS enabled. The following migrations are recorded in the project:

- `firebase_auth_supabase_tools_and_site_media`
- `hide_legacy_seeded_tools_for_admin_only_catalog`
- `restore_legacy_custom_tool_endpoint_in_config`
- `start_tool_catalog_empty_until_admin_enables_tools`
- `restrict_firebase_bridge_table_writes`

The last migration removes direct INSERT/UPDATE/DELETE privileges from Supabase `anon` and `authenticated` roles on `tools` and `site_settings`; Firebase-verified server routes use `service_role` for authorized writes. The database currently has 11 legacy tool rows and 0 enabled tools, so the public catalogue starts empty until the administrator enables or creates tools.

All three required Storage buckets already exist. `cyberx-site-media` is public-read with a 2 MB image limit; avatar and user-media buckets are private with a 5 MB image limit. New uploads are handled by the server-side Firebase-authenticated API routes.

After adding `SUPABASE_SERVICE_ROLE_KEY` in Vercel, redeploy the project. Do not send the key in chat or commit it.
