# CyberX OSINT

Android-first, responsive public-source research workspace built with Next.js 15, React 19 and optional Supabase authentication.

## Included
- Mobile-first CyberX interface with responsive bottom navigation.
- Dashboard, tools directory, search history, profile and settings views.
- Public IP metadata lookup (IPwho.is).
- Public domain registration/RDAP lookup (rdap.org).
- PWA manifest and app icon.
- Optional Supabase Auth configuration.

## Run locally
1. Install Node.js 20.9 or newer.
2. Copy `.env.example` to `.env.local`.
3. Add your Supabase project URL and publishable/anon key if enabling authentication.
4. Run `npm install`, then `npm run dev`.
5. Open http://localhost:3000.

## Deploy
Import this repository into Vercel or deploy on any Node.js host. Build command: `npm run build`; start command: `npm start`.

## Safety and privacy
This project is designed for lawful research using public, non-sensitive technical information. It does not provide private-person tracking, account access, password discovery, data-breach dumps, or phone-number identity lookup. IP lookups return approximate network/geographic metadata and must not be treated as a person's precise location.

## Supabase
The UI runs without Supabase. To enable real authentication, configure the environment variables and complete the SQL setup in `supabase/schema.sql`. Never put a Supabase service-role/secret key in a browser environment variable.
