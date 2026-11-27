import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
if (!raw || !email) throw new Error("Set FIREBASE_SERVICE_ACCOUNT_JSON and ADMIN_EMAIL.");
let serviceAccount;
try {
  serviceAccount = JSON.parse(raw);
} catch {
  throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must be the complete service-account JSON.");
}
const projectId = process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id;
if (!projectId || projectId !== serviceAccount.project_id) {
  throw new Error("FIREBASE_PROJECT_ID must match the service-account project_id.");
}

const app = initializeApp({ credential: cert(serviceAccount), projectId });
const auth = getAuth(app);
const user = await auth.getUserByEmail(email);

if (!user.emailVerified) {
  throw new Error(
    `The account ${email} has not verified its email yet. Verify it on the website, then run npm run set-admin again.`
  );
}
if (user.disabled) {
  throw new Error("This Firebase Auth account is disabled. Enable it before granting administrator access.");
}

await auth.setCustomUserClaims(user.uid, {
  ...(user.customClaims || {}),
  admin: true,
});
await getFirestore(app).collection("profiles").doc(user.uid).set(
  {
    id: user.uid,
    email,
    role: "admin",
    status: "active",
    updated_at: new Date().toISOString(),
  },
  { merge: true }
);

console.log(
  "Firebase admin role enabled for the verified account. Sign out and sign in again to refresh the admin token."
);
