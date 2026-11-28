import { NextResponse } from "next/server";
import { adminAuth, adminDb, verifyBearer } from "@/lib/firebase/admin";
export const runtime = "nodejs";

// Keeps the Firebase `admin` custom claim in sync with the profile role stored in Firestore.
// Accounts listed in FIREBASE_ADMIN_EMAILS (comma separated) or ADMIN_EMAIL become admin automatically.
export async function POST(request: Request) {
  try {
    const decoded = await verifyBearer(request);
    const db = adminDb();
    const ref = db.collection("profiles").doc(decoded.uid);
    const now = new Date().toISOString();
    const allow = [process.env.FIREBASE_ADMIN_EMAILS, process.env.ADMIN_EMAIL].join(",")
      .split(",").map(v => v.trim().toLowerCase()).filter(Boolean);
    const email = String(decoded.email || "").toLowerCase();
    if (email && allow.includes(email)) {
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
