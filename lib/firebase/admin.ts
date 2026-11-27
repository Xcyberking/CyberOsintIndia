import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON server environment variable.");
  const serviceAccount = JSON.parse(raw);
  return initializeApp({ credential: cert(serviceAccount), projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || serviceAccount.project_id });
}
export function adminAuth() { return getAuth(getAdminApp()); }
export function adminDb() { return getFirestore(getAdminApp()); }
export async function verifyBearer(request: Request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Sign in to continue.");
  return adminAuth().verifyIdToken(token);
}
export async function requireAdmin(request: Request) {
  const decoded = await verifyBearer(request);
  if (decoded.admin !== true) throw new Error("Administrator permission required.");
  return decoded;
}
