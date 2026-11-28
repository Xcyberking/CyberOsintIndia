import { NextResponse } from "next/server";
import { adminAuth, adminDb, verifyBearer } from "@/lib/firebase/admin";
import { r2 } from "@/lib/firebase/wallet";
import type { DocumentReference } from "firebase-admin/firestore";
export const runtime = "nodejs";

// Rewards are wallet rupees (INR). Defaults are 0 until the admin sets them in Referral Reward Settings.
function reward(value: unknown, fallback: number) {
  const raw = value && typeof value === "object" ? (value as {credits?:unknown}).credits : value;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 100000 ? r2(n) : fallback;
}
export async function POST(request: Request) {
  try {
    const decoded = await verifyBearer(request);
    const db = adminDb();
    const profileRef = db.collection("profiles").doc(decoded.uid);
    const profileSnap = await profileRef.get();
    if (!profileSnap.exists) return NextResponse.json({error:"Profile not found."},{status:404});

    // Promote only explicitly allowlisted, email-verified accounts. Never trust a client-supplied role.
    const adminEmails = [process.env.FIREBASE_ADMIN_EMAILS, process.env.ADMIN_EMAIL].join(",")
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
    const signupAmount = reward(settings[0].data()?.value, 0);
    const referredAmount = reward(settings[1].data()?.value, 0);
    const referrerAmount = reward(settings[2].data()?.value, 0);
    const referralCode = String(profileSnap.data()?.pending_referral_code || "").trim();
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
      const total = r2(signupAmount + (hasReferrer ? referredAmount : 0));
      const balance = r2(Number(fresh.data()?.wallet_balance || 0) + total);
      tx.update(profileRef, { wallet_balance: balance, signup_processed: true, pending_referral_code: null, updated_at: now });
      if (total > 0) {
        const l1 = db.collection("credit_transactions").doc();
        tx.set(l1,{user_id:decoded.uid,delta:total,reason:"Signup reward",created_at:now});
        const w1 = db.collection("wallet_transactions").doc();
        tx.set(w1,{id:w1.id,user_id:decoded.uid,amount_inr:total,balance_after:balance,transaction_type:"bonus",description:"Signup reward",created_at:now});
      }
      if (hasReferrer && referrerRef && referrer) {
        if (referrerAmount > 0) {
          const rb = r2(Number(referrer.data()?.wallet_balance || 0) + referrerAmount);
          tx.update(referrerRef,{wallet_balance:rb,updated_at:now});
          const l2 = db.collection("credit_transactions").doc();
          tx.set(l2,{user_id:referrerRef.id,delta:referrerAmount,reason:"Referral reward",created_at:now});
          const w2 = db.collection("wallet_transactions").doc();
          tx.set(w2,{id:w2.id,user_id:referrerRef.id,amount_inr:referrerAmount,balance_after:rb,transaction_type:"bonus",description:"Referral reward",created_at:now});
        }
        const claim = db.collection("referral_claims").doc();
        tx.set(claim,{id:claim.id,referrer_id:referrerRef.id,referred_id:decoded.uid,reward:referrerAmount,status:"qualified",created_at:now});
      }
    });
    return NextResponse.json({ok:true});
  } catch(e) { return NextResponse.json({error:e instanceof Error?e.message:"Could not apply signup rewards."},{status:400}); }
}
