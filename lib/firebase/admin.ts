import "server-only";
import { createHash } from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON. Add it as a server-only Vercel environment variable.");
  let serviceAccount: { project_id?: string; client_email?: string; private_key?: string };
  try { serviceAccount = JSON.parse(raw); }
  catch { throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must contain the complete service-account JSON."); }
  const projectId = process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id;
  if (!projectId || !serviceAccount.client_email || !serviceAccount.private_key) throw new Error("Firebase Admin credentials are incomplete. Download a new service-account JSON.");
  if (serviceAccount.project_id && projectId !== serviceAccount.project_id) throw new Error("FIREBASE_PROJECT_ID does not match the service-account project_id.");
  return initializeApp({ credential: cert({ ...serviceAccount, projectId }), projectId });
}
export function adminAuth() { return getAuth(getAdminApp()); }
export function adminDb() { return getFirestore(getAdminApp()); }
export async function verifyBearer(request: Request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Sign in to continue.");
  const decoded = await adminAuth().verifyIdToken(token);
  if (decoded.email_verified !== true) throw new Error("Verify your email address before using this service.");
  return decoded;
}
export async function requireAdmin(request: Request) {
  const decoded = await verifyBearer(request);
  if (decoded.admin !== true) throw new Error("Administrator permission required.");
  const settings = await adminDb().collection("admin_security").doc("settings").get();
  if (settings.data()?.enabled === true) {
    const token = request.headers.get("cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith("cx_admin_verified="))?.slice("cx_admin_verified=".length);
    if (!token) throw new Error("Telegram OTP verification required.");
    const key = createHash("sha256").update(token).digest("hex");
    const session = await adminDb().collection("admin_2fa_sessions").doc(key).get();
    const data = session.data();
    if (!session.exists || data?.uid !== decoded.uid || Number(data.expiresAt) <= Date.now()) throw new Error("Admin verification expired. Login and verify Telegram OTP again.");
  }
  return decoded;
}
