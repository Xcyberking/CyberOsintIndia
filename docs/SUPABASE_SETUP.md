# CyberX OSINT: Firebase Auth + Supabase Tools/Images

This project keeps Firebase Authentication and Firebase user profiles/wallet data. The following data is stored in the CyberOsintIndia Supabase project:

- `public.tools` tool catalogue
- `public.site_settings` public site/payment settings
- Uploaded site images and QR codes (`cyberx-site-media`)
- User avatars (`cyberx-avatars`)
- Payment proof images (`cyberx-user-media`)

## Vercel environment variable

Add this server-only variable to the Vercel project for Production, Preview, and Development:

- `SUPABASE_SERVICE_ROLE_KEY`: the secret/service-role API key from Supabase Project Settings → API Keys.

The project URL defaults to `https://pwwwoppmhefscguajzwc.supabase.co`. You can optionally set `SUPABASE_URL` to the same URL.

**Never** prefix the service-role/secret key with `NEXT_PUBLIC_`, place it in client-side code, or commit it to GitHub. Firebase login continues to use the existing `NEXT_PUBLIC_FIREBASE_*` variables and server-side `FIREBASE_SERVICE_ACCOUNT_JSON`.

After adding the variable, redeploy the Vercel project.

## How authorization works

The browser continues to sign in with Firebase. Server API routes verify the Firebase ID token. Tool/settings mutations and site QR uploads additionally require the Firebase admin custom claim. The server uses the Supabase service-role key only after those checks; it is never sent to the browser.

Public users can read enabled tools and approved public payment settings. Private user media is scoped to the Firebase UID in the object path. Site media is served from a public Supabase Storage bucket, while only admins can upload it.

## Existing data

The Supabase `CyberOsintIndia` project already contained the tools and site settings tables. The migration added `price_inr`, exposed the UPI setting to public Store reads, and created the public `cyberx-site-media` bucket. Previously seeded built-in tools are disabled so the administrator can decide which ones to enable. The admin panel imports any non-duplicate legacy Firestore tools once after admin login.
