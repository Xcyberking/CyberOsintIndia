import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
if (!raw || !email) throw new Error("Set FIREBASE_SERVICE_ACCOUNT_JSON and ADMIN_EMAIL.");
const serviceAccount = JSON.parse(raw);
const app = initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
const auth = getAuth(app);
const user = await auth.getUserByEmail(email);
await auth.setCustomUserClaims(user.uid, { ...(user.customClaims || {}), admin: true });
await getFirestore(app).collection("profiles").doc(user.uid).set({
  id: user.uid, email, role: "admin", status: "active",
  updated_at: new Date().toISOString()
}, { merge: true });
console.log("Firebase admin role enabled for", email, "- ask the user to sign out and sign in again.");
