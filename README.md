# CyberX OSINT

Android-first public-source research workspace built with Next.js 15, React 19 and Firebase.

## Firebase project setup
Use the same Firebase project for the Web App, Authentication, Firestore and Storage.

1. Firebase Console → Project settings → General → Your apps → Add app → Web. Register a Web App.
2. Copy its Web config values for the six `NEXT_PUBLIC_FIREBASE_*` variables below.
3. Authentication → Sign-in method → enable Email/Password. Add your Vercel domain under Authentication → Settings → Authorized domains. Google/GitHub are optional.
4. Firestore Database → Create database. Choose production mode and a region.
5. Storage → Get started → create the default bucket in this same project. Use the exact bucket name from Firebase config.
6. Project settings → Service accounts → Firebase Admin SDK → Generate new private key. Keep the downloaded JSON private. Never upload it to GitHub or paste it into chat.

## Environment variables
Copy `.env.example` to `.env.local` and fill:

| Variable | Value from |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Web config `apiKey` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Web config `authDomain` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Web config `projectId` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Web config `storageBucket` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Web config `messagingSenderId` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Web config `appId` |
| `FIREBASE_PROJECT_ID` | Same Firebase project ID |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Complete downloaded Admin SDK JSON, one line; server-only |
| `ADMIN_EMAIL` | Verified owner account email; local setup only |

The six `NEXT_PUBLIC_*` values are web config and are browser-visible by design. `FIREBASE_SERVICE_ACCOUNT_JSON` contains a private key: never prefix it with `NEXT_PUBLIC_`, commit it, or share it. `ADMIN_EMAIL` is only needed for the one-time admin setup script.

After saving `.env.local`, run:

```bash
npm install
npm run env:check
npx firebase-tools login
npx firebase-tools use --add
npx firebase-tools deploy --only firestore:rules,firestore:indexes,storage
npm run seed
npm run dev
```

The env check validates required values, parses the service account and verifies all project IDs match. It never prints the private key.

## First administrator
1. Register the owner account on the site and verify its email.
2. Add `ADMIN_EMAIL=your-verified-email` to local `.env.local`.
3. Run `npm run set-admin`.
4. Sign out and sign in again to refresh the Firebase admin claim. The browser cannot grant admin privileges.

## Vercel environment variables
Vercel → your CyberOsintIndia project → Settings → Environment Variables. Add these eight names, one by one:

```text
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
FIREBASE_PROJECT_ID
FIREBASE_SERVICE_ACCOUNT_JSON
```

Paste the value only (not the variable name or an equals sign). Paste the entire service-account JSON as one line for `FIREBASE_SERVICE_ACCOUNT_JSON`. Select Production, Preview and Development as required. Do not add `ADMIN_EMAIL` to Vercel for normal operation. Save, then trigger a new deployment; existing deployments do not automatically receive changed env vars.

## Firestore collections
Run `npm run seed` once after local credentials are configured. It creates nine starter public research tools and default settings. App collections include `profiles`, `tools`, `premium_plans`, `site_settings`, `payment_records`, `wallet_transactions`, `credit_transactions`, `referral_claims`, `search_history`, `announcements`, `support_tickets`, `api_integrations`, `developer_resources`, and `admin_audit_logs`.

This is a fresh start: no Supabase users, passwords, balances, deposits or transaction history are imported. Register new Firebase Auth accounts.

## Wallet and manual payments
- Razorpay is not used. Users submit a manual UPI/bank reference and optional proof.
- Admin must independently verify receipt in the actual bank/UPI account before approving.
- Wallet credit and payment status change happen in one server-side Firestore transaction.
- Tool charges are server-side and occur only after a successful upstream response.
- A tool's `price_inr` is the per-query wallet price.

Use payment accounts only with an eligible adult account holder's supervision where required by provider rules and local law.

## Build
```bash
npm run lint
npm run build
```

Deploy to Vercel with `npm run build`. Firebase web config and Admin SDK credentials must be present in Vercel Environment Variables before rebuilding.

## Privacy and safety
This project is scoped to lawful research using public, non-sensitive technical information. It does not provide private-person tracking, account intrusion, password discovery, leaked personal-data dumps, or phone-number identity lookup. IP lookups are approximate network metadata.
