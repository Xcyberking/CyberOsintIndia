import { NextResponse } from "next/server";
import { adminAuth, adminDb, verifyBearer } from "@/lib/firebase/admin";
export const runtime = "nodejs";

// Keeps the Firebase `admin` custom claim in sync with the profile role stored in Firestore.
// Optional bootstrap: the verified account whose email equals ADMIN_EMAIL becomes admin automatically.
export async function POST(request: Request) {
  try {
    const decoded = await verifyBearer(request);
    const db = adminDb();
    const ref = db.collection("profiles").doc(decoded.uid);
    const now = new Date().toISOString();
    const bootstrap = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const email = String(decoded.email || "").toLowerCase();
    if (bootstrap && email === bootstrap) {
      await ref.set({ id: decoded.uid, email, role: "admin", status: "active", updated_at: now }, { merge: true });
    }
    const snap = await ref.get();
    const p = snap.data();
    const isAdmin = snap.exists && p?.role === "admin" && p?.status === "active";
    const user = await adminAuth().getUser(decoded.uid);
    const claims = user.customClaims || {};
    const changed = (claims.admin === true) !== isAdmin;
    if (changed) await adminAuth().setCustomUserClaims(decoded.uid, { ...claims, admin: isAdmin });
    return NextResponse.json({ admin: isAdmin, refreshed: changed });
  } catch (e) {
    return NextResponse.json({ admin: false, error: e instanceof Error ? e.message : "Admin check failed." }, { status: 400 });
  }
}
