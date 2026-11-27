# CyberX OSINT

Android-first public-source research workspace built with Next.js 15, React 19 and Firebase.

## Firebase setup (fresh project)
1. In Firebase Console, open the new project and add a **Web app**.
2. Enable **Authentication → Email/Password**. Enable Google and GitHub providers only if you intend to use them; add your deployed domain to Authorized domains.
3. Create **Cloud Firestore** in production mode and **Firebase Storage**.
4. Copy `.env.example` to `.env.local` and fill in the six `NEXT_PUBLIC_FIREBASE_*` values from the Web App config.
5. Create a Firebase service account in Project settings → Service accounts. Store its full JSON privately as `FIREBASE_SERVICE_ACCOUNT_JSON` in your server hosting environment. Never use a `NEXT_PUBLIC_` prefix for it and never commit it.
6. Deploy Firestore and Storage rules from `firestore.rules` and `storage.rules` (Firebase CLI: `npx firebase-tools deploy --only firestore:rules,firestore:indexes,storage`).
7. Install dependencies with `npm install`, then run `npm run dev`.
8. Put the one-line service-account JSON in `.env.local` as `FIREBASE_SERVICE_ACCOUNT_JSON`, then run `npm run seed` to add the initial nine tools and default settings.
9. Register your owner account in the app and verify its email. Add `ADMIN_EMAIL=your-verified-email` to `.env.local`, then run `npm run set-admin`. The script assigns the Firebase custom admin claim and admin profile. Sign out and sign in again to refresh the token.
10. Add the same public Firebase web config to Vercel environment variables, and the service-account JSON as a server-only environment variable. Redeploy.

## Data model
Firestore collections: `profiles`, `tools`, `premium_plans`, `site_settings`, `payment_records`, `wallet_transactions`, `credit_transactions`, `referral_claims`, `search_history`, `announcements`, `support_tickets`, `api_integrations`, `developer_resources`, and `admin_audit_logs`.

The migration is a **fresh start**: no Supabase users, passwords, balances, deposits or transaction history are imported. Register new Firebase Auth accounts. Admin role is granted only by the server-side setup script/custom claim, not by a browser field.

## Wallet and manual payments
- Razorpay is not used. The user submits a manual UPI/bank reference and optional proof.
- Admin must independently verify receipt in the actual bank/UPI account before approving.
- Wallet credit and payment status change happen in one server-side Firestore transaction.
- Tool charges are server-side and occur only after a successful upstream response.
- A tool's `price_inr` is the per-query wallet price.

Use payment accounts only with an eligible adult account holder's supervision where required by the provider and local rules.

## Run and deploy
```bash
npm install
npm run dev
npm run build
```
Deploy to Vercel with `npm run build`. Set the public Firebase Web SDK variables and the private `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable, then redeploy.

## Privacy and safety
This project is scoped to lawful research using public, non-sensitive technical information. It does not provide private-person tracking, account intrusion, password discovery, leaked personal-data dumps, or phone-number identity lookup. IP lookups are approximate network metadata.
