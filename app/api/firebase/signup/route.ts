import { NextResponse } from "next/server";
import { adminAuth, adminDb, verifyBearer } from "@/lib/firebase/admin";
import type { DocumentReference } from "firebase-admin/firestore";
export const runtime = "nodejs";

function reward(value: unknown, fallback: number) {
  const raw = value && typeof value === "object" ? (value as {credits?:unknown}).credits : value;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= 0 && n <= 100000 ? n : fallback;
}
export async function POST(request: Request) {
  try {
    const decoded = await verifyBearer(request);
    const db = adminDb();
    const profileRef = db.collection("profiles").doc(decoded.uid);
    const profileSnap = await profileRef.get();
    if (!profileSnap.exists) return NextResponse.json({error:"Profile not found."},{status:404});

    // Promote only explicitly allowlisted, email-verified accounts. Never trust a client-supplied role.
    const adminEmails = (process.env.FIREBASE_ADMIN_EMAILS || "")
      .split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
    const accountEmail = String(decoded.email || "").trim().toLowerCase();
    if (accountEmail && adminEmails.includes(accountEmail)) {
      const auth = adminAuth();
      const user = await auth.getUser(decoded.uid);
      await auth.setCustomUserClaims(decoded.uid, { ...(user.customClaims || {}), admin: true });
      await profileRef.set({ role: "admin", status: "active", updated_at: new Date().toISOString() }, { merge: true });
    }

    if (profileSnap.data()?.signup_processed === true) {
      return NextResponse.json({ ok: true, alreadyProcessed: true, admin: Boolean(accountEmail && adminEmails.includes(accountEmail)) });
    }
    const settings = await Promise.all([
      db.collection("site_settings").doc("default_signup_credits").get(),
      db.collection("site_settings").doc("referral_new_user_credits").get(),
      db.collection("site_settings").doc("referral_reward").get()
    ]);
    const signupCredits = reward(settings[0].data()?.value, 3);
    const referredCredits = reward(settings[1].data()?.value, 7);
    const referrerCredits = reward(settings[2].data()?.value, 3);
    const referralCode = String(profileSnap.data()?.pending_referral_code || "") .trim();
    let referrerRef: DocumentReference | null = null;
    if (referralCode) {
      const match = await db.collection("profiles").where("referral_code","==",referralCode).limit(1).get();
      if (!match.empty && match.docs[0].id !== decoded.uid && match.docs[0].data().status === "active") referrerRef = match.docs[0].ref;
    }
    await db.runTransaction(async tx => {
      const fresh = await tx.get(profileRef);
      if (!fresh.exists || fresh.data()?.signup_processed === true) return;
      const referrer = referrerRef ? await tx.get(referrerRef) : null;
      const hasReferrer = Boolean(referrer?.exists && referrerRef);
      const now = new Date().toISOString();
      const referredBonus = hasReferrer ? referredCredits : 0;
      tx.update(profileRef, { credits: Number(fresh.data()?.credits || 0) + signupCredits + referredBonus, signup_processed: true, pending_referral_code: null, updated_at: now });
      const signupLedger = db.collection("credit_transactions").doc();
      tx.set(signupLedger,{user_id:decoded.uid,delta:signupCredits,reason:"Signup reward",created_at:now});
      if (hasReferrer && referrerRef && referrer) {
        tx.update(referrerRef,{credits:Number(referrer.data()?.credits||0)+referrerCredits,updated_at:now});
        const referrerLedger = db.collection("credit_transactions").doc();
        tx.set(referrerLedger,{user_id:referrerRef.id,delta:referrerCredits,reason:"Referral reward",created_at:now});
        const claim = db.collection("referral_claims").doc();
        tx.set(claim,{id:claim.id,referrer_id:referrerRef.id,referred_id:decoded.uid,reward:referrerCredits,status:"qualified",created_at:now});
      }
    });
    return NextResponse.json({ok:true});
  } catch(e) { return NextResponse.json({error:e instanceof Error?e.message:"Could not apply signup rewards."},{status:400}); }
}
