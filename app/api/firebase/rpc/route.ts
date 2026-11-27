import { NextResponse } from "next/server";
import { adminAuth, adminDb, requireAdmin, verifyBearer } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export async function POST(request: Request) {
  try {
    const { name, args = {} } = await request.json();
    const decoded = name === "consume_tool_wallet" || name === "create_wallet_deposit_request"
      ? await verifyBearer(request) : await requireAdmin(request);
    const db = adminDb();
    const uid = decoded.uid;
    if (name === "create_wallet_deposit_request") {
      const amount = Number(args.p_amount_inr);
      const utr = String(args.p_utr || "").trim();
      if (!Number.isFinite(amount) || amount < 10 || amount > 50000 || utr.length < 6 || utr.length > 80) return json({ error: "Invalid deposit amount or UTR." }, 400);
      const profile = await db.collection("profiles").doc(uid).get();
      if (!profile.exists || profile.data()?.status !== "active") return json({ error: "Account is not active." }, 403);
      const pending = await db.collection("payment_records").where("user_id", "==", uid).where("status", "==", "pending").where("payment_type", "==", "wallet").limit(1).get();
      if (!pending.empty) return json({ error: "A wallet deposit request is already pending." }, 409);
      const ref = db.collection("payment_records").doc();
      await ref.set({ id: ref.id, user_id: uid, provider: "manual_qr", provider_reference: utr, amount_inr: amount, status: "pending", proof_url: args.p_proof_url || null, payment_type: "wallet", created_at: new Date().toISOString() });
      return json({ data: ref.id });
    }
    if (name === "consume_tool_wallet") {
      const slug = String(args.p_tool_slug || "");
      const toolSnap = await db.collection("tools").where("slug", "==", slug).limit(1).get();
      if (toolSnap.empty || toolSnap.docs[0].data().enabled !== true) return json({ error: "Tool is unavailable." }, 404);
      const profileRef = db.collection("profiles").doc(uid);
      const tool = toolSnap.docs[0].data();
      const cost = Math.max(0, Number(tool.price_inr || 0));
      let balance = 0;
      await db.runTransaction(async tx => {
        const profile = await tx.get(profileRef);
        const current = Number(profile.data()?.wallet_balance || 0);
        if (!profile.exists || profile.data()?.status !== "active") throw new Error("Account is not active.");
        if (current < cost) throw new Error("Insufficient wallet balance.");
        balance = current - cost;
        tx.update(profileRef, { wallet_balance: balance, updated_at: new Date().toISOString() });
        const ledger = db.collection("wallet_transactions").doc();
        tx.set(ledger, { id: ledger.id, user_id: uid, amount_inr: -cost, balance_after: balance, transaction_type: "tool_usage", description: "Tool query: " + (tool.name || slug), created_at: new Date().toISOString() });
      });
      return json({ data: balance });
    }
    if (name === "admin_review_payment") {
      const paymentId = String(args.p_payment_id || "");
      const approve = args.p_approve === true;
      const paymentRef = db.collection("payment_records").doc(paymentId);
      await db.runTransaction(async tx => {
        const paymentSnap = await tx.get(paymentRef);
        if (!paymentSnap.exists) throw new Error("Payment request not found.");
        const payment = paymentSnap.data()!;
        if (payment.status !== "pending") throw new Error("This payment has already been reviewed.");
        const now = new Date().toISOString();
        if (!approve) {
          tx.update(paymentRef, { status: "rejected", admin_note: String(args.p_admin_note || "Payment not verified."), reviewed_at: now, reviewed_by: uid });
          return;
        }
        const userRef = db.collection("profiles").doc(String(payment.user_id));
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists || userSnap.data()?.status !== "active") throw new Error("Payment owner account is not active.");
        if (payment.payment_type === "wallet") {
          const balance = Number(userSnap.data()?.wallet_balance || 0) + Number(payment.amount_inr || 0);
          tx.update(userRef, { wallet_balance: balance, updated_at: now });
          const ledger = db.collection("wallet_transactions").doc();
          tx.set(ledger, { id: ledger.id, user_id: payment.user_id, amount_inr: Number(payment.amount_inr || 0), balance_after: balance, transaction_type: "deposit", description: "Manual wallet deposit approved", created_at: now, payment_id: paymentId });
        } else if (payment.plan_id) {
          const planSnap = await tx.get(db.collection("premium_plans").doc(String(payment.plan_id)));
          if (!planSnap.exists) throw new Error("Selected plan no longer exists.");
          const plan = planSnap.data()!;
          tx.update(userRef, { plan_name: plan.name, plan_expires_at: new Date(Date.now() + Number(plan.duration_days || 30) * 86400000).toISOString(), credits: Number(userSnap.data()?.credits || 0) + Number(plan.credits || 0), updated_at: now });
        }
        tx.update(paymentRef, { status: "approved", admin_note: args.p_admin_note || "Payment verified by administrator.", reviewed_at: now, reviewed_by: uid });
      });
      return json({ data: true });
    }
    if (name === "admin_update_user") {
      const id = String(args.target_user_id || "");
      const ref = db.collection("profiles").doc(id);
      const snap = await ref.get(); if (!snap.exists) throw new Error("User not found.");
      const patch: Record<string, unknown> = {};
      if (args.new_role) patch.role = args.new_role;
      if (args.new_status) patch.status = args.new_status;
      const delta = Number(args.credit_delta || 0);
      if (delta) {
        const next = Number(snap.data()?.credits || 0) + delta;
        if (next < 0) throw new Error("Credit balance cannot be negative.");
        patch.credits = next;
        await db.collection("credit_transactions").add({ user_id: id, delta, reason: String(args.credit_reason || "Admin adjustment"), created_at: new Date().toISOString() });
      }
      await ref.update(patch);
      if (args.new_role === "admin") await adminAuth().setCustomUserClaims(id, { admin: true });
      if (args.new_role === "user") await adminAuth().setCustomUserClaims(id, { admin: false });
      return json({ data: true });
    }
    if (name === "admin_bulk_grant_credits") {
      const delta = Number(args.p_credit_delta || 0);
      if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100000) throw new Error("Invalid credit amount.");
      const users = await db.collection("profiles").get();
      let changed = 0;
      for (const batch of Array.from({length: Math.ceil(users.size / 400)}, (_,i)=>users.docs.slice(i*400,(i+1)*400))) {
        const write = db.batch();
        for (const user of batch) { const next = Number(user.data().credits || 0) + delta; if (next < 0) continue; write.update(user.ref, { credits: next }); write.set(db.collection("credit_transactions").doc(), { user_id: user.id, delta, reason: String(args.p_reason || "Admin bulk adjustment"), created_at: new Date().toISOString() }); changed++; }
        await write.commit();
      }
      return json({ data: changed });
    }
    if (name === "admin_assign_plan") {
      const [userRef, planSnap] = [db.collection("profiles").doc(String(args.p_target_user_id)), await db.collection("premium_plans").doc(String(args.p_plan_id)).get()];
      if (!planSnap.exists) throw new Error("Plan not found.");
      const plan = planSnap.data()!;
      await db.runTransaction(async tx => { const u = await tx.get(userRef); if (!u.exists) throw new Error("User not found."); tx.update(userRef, { plan_name: plan.name, plan_expires_at: new Date(Date.now() + Number(plan.duration_days || 30) * 86400000).toISOString(), credits: Number(u.data()?.credits || 0) + (args.p_add_credits ? Number(plan.credits || 0) : 0) }); });
      return json({ data: true });
    }
    return json({ error: "Unsupported operation." }, 400);
  } catch (e) { return json({ error: e instanceof Error ? e.message : "Request failed." }, 400); }
}
