import { NextResponse } from "next/server";
import { adminAuth, adminDb, requireAdmin, verifyBearer } from "@/lib/firebase/admin";
import { chargeTool, walletStatus, r2 } from "@/lib/firebase/wallet";

export const runtime = "nodejs";
const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
const USER_OPS = ["consume_tool_wallet", "check_tool_wallet", "create_wallet_deposit_request", "redeem_code"];

// NOTE: all former "credit" amounts are now wallet rupees (INR): redeem codes, plan bonuses, admin adjustments.
export async function POST(request: Request) {
  try {
    const { name, args = {} } = await request.json();
    const decoded = USER_OPS.includes(name) ? await verifyBearer(request) : await requireAdmin(request);
    const db = adminDb();
    const uid = decoded.uid;

    if (name === "admin_create_redeem_code") {
      const code = String(args.p_code || "").trim().toUpperCase();
      const credits = Number(args.p_credits);
      const maxUses = Number(args.p_max_uses);
      if (!/^[A-Z0-9-]{4,32}$/.test(code)) return json({ error: "Code must be 4–32 characters using A–Z, 0–9 or hyphens." }, 400);
      if (!Number.isSafeInteger(credits) || credits < 1 || credits > 1000000) return json({ error: "Amount must be a whole number from 1 to 1,000,000." }, 400);
      if (!Number.isSafeInteger(maxUses) || maxUses < 1 || maxUses > 100000) return json({ error: "Maximum users must be a whole number from 1 to 100,000." }, 400);
      const ref = db.collection("redeem_codes").doc(code);
      await db.runTransaction(async tx => {
        const existing = await tx.get(ref);
        if (existing.exists) throw new Error("That redeem code already exists.");
        const now = new Date().toISOString();
        tx.create(ref, { id: code, code, credits, max_uses: maxUses, used_count: 0, active: true, created_by: uid, created_at: now, updated_at: now });
      });
      return json({ data: { code, credits, max_uses: maxUses, used_count: 0, active: true } });
    }
    if (name === "admin_deactivate_redeem_code") {
      const code = String(args.p_code || "").trim().toUpperCase();
      if (!/^[A-Z0-9-]{4,32}$/.test(code)) return json({ error: "Invalid redeem code." }, 400);
      const ref = db.collection("redeem_codes").doc(code);
      const snap = await ref.get();
      if (!snap.exists) return json({ error: "Redeem code not found." }, 404);
      await ref.update({ active: false, updated_at: new Date().toISOString() });
      return json({ data: true });
    }
    if (name === "redeem_code") {
      const code = String(args.p_code || "").trim().toUpperCase();
      if (!/^[A-Z0-9-]{4,32}$/.test(code)) return json({ error: "Enter a valid redeem code." }, 400);
      const codeRef = db.collection("redeem_codes").doc(code);
      const profileRef = db.collection("profiles").doc(uid);
      const redemptionRef = codeRef.collection("redemptions").doc(uid);
      let result: { credits: number; balance: number; used_count: number; max_uses: number } | null = null;
      await db.runTransaction(async tx => {
        const [codeSnap, profileSnap, redemptionSnap] = await Promise.all([tx.get(codeRef), tx.get(profileRef), tx.get(redemptionRef)]);
        if (!codeSnap.exists || codeSnap.data()?.active !== true) throw new Error("This redeem code is invalid or inactive.");
        if (!profileSnap.exists || profileSnap.data()?.status !== "active") throw new Error("Your account is not active.");
        if (redemptionSnap.exists) throw new Error("You have already used this redeem code.");
        const codeData = codeSnap.data()!;
        const used = Number(codeData.used_count || 0);
        const max = Number(codeData.max_uses || 0);
        const reward = Number(codeData.credits || 0);
        if (!Number.isSafeInteger(used) || !Number.isSafeInteger(max) || !Number.isSafeInteger(reward) || max < 1 || reward < 1) throw new Error("Redeem code configuration is invalid.");
        if (used >= max) throw new Error("This redeem code has reached its maximum number of users.");
        const balance = r2(Number(profileSnap.data()?.wallet_balance || 0) + reward);
        if (!Number.isFinite(balance) || balance < 0 || balance > 100000000) throw new Error("Wallet balance limit reached.");
        const now = new Date().toISOString();
        tx.update(profileRef, { wallet_balance: balance, updated_at: now });
        tx.update(codeRef, { used_count: used + 1, active: used + 1 < max, updated_at: now });
        tx.create(redemptionRef, { user_id: uid, code, credits: reward, redeemed_at: now });
        const ledgerRef = db.collection("wallet_transactions").doc();
        tx.create(ledgerRef, { id: ledgerRef.id, user_id: uid, amount_inr: reward, balance_after: balance, transaction_type: "bonus", description: "Redeem code: " + code, created_at: now });
        result = { credits: reward, balance, used_count: used + 1, max_uses: max };
      });
      return json({ data: result });
    }

    if (name === "create_wallet_deposit_request") {
      const amount = r2(Number(args.p_amount_inr));
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

    if (name === "check_tool_wallet") {
      return json({ data: await walletStatus(db, uid, String(args.p_tool_slug || "")) });
    }

    if (name === "consume_tool_wallet") {
      const c = await chargeTool(db, uid, String(args.p_tool_slug || ""));
      return json({ data: c.balance, charge_id: c.chargeId, price: c.price });
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
          const balance = r2(Number(userSnap.data()?.wallet_balance || 0) + Number(payment.amount_inr || 0));
          tx.update(userRef, { wallet_balance: balance, updated_at: now });
          const ledger = db.collection("wallet_transactions").doc();
          tx.set(ledger, { id: ledger.id, user_id: payment.user_id, amount_inr: Number(payment.amount_inr || 0), balance_after: balance, transaction_type: "deposit", description: "Manual wallet deposit approved", created_at: now, payment_id: paymentId });
        } else if (payment.plan_id) {
          const planSnap = await tx.get(db.collection("premium_plans").doc(String(payment.plan_id)));
          if (!planSnap.exists) throw new Error("Selected plan no longer exists.");
          const plan = planSnap.data()!;
          const bonus = r2(Number(plan.credits || 0));
          const balance = r2(Number(userSnap.data()?.wallet_balance || 0) + bonus);
          tx.update(userRef, { plan_name: plan.name, plan_expires_at: new Date(Date.now() + Number(plan.duration_days || 30) * 86400000).toISOString(), wallet_balance: balance, updated_at: now });
          if (bonus > 0) {
            const ledger = db.collection("wallet_transactions").doc();
            tx.set(ledger, { id: ledger.id, user_id: payment.user_id, amount_inr: bonus, balance_after: balance, transaction_type: "bonus", description: "Plan wallet bonus: " + plan.name, created_at: now, payment_id: paymentId });
          }
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
      const delta = r2(Number(args.credit_delta || 0));
      const now = new Date().toISOString();
      if (delta) {
        const next = r2(Number(snap.data()?.wallet_balance || 0) + delta);
        if (next < 0) throw new Error("Wallet balance cannot be negative.");
        patch.wallet_balance = next;
        const ledger = db.collection("wallet_transactions").doc();
        await ledger.set({ id: ledger.id, user_id: id, amount_inr: delta, balance_after: next, transaction_type: "admin_adjustment", description: String(args.credit_reason || "Admin adjustment"), created_at: now });
      }
      if (Object.keys(patch).length) await ref.update({ ...patch, updated_at: now });
      if (args.new_role) await adminAuth().setCustomUserClaims(id, { ...(await adminAuth().getUser(id)).customClaims, admin: args.new_role === "admin" });
      return json({ data: true });
    }

    if (name === "admin_bulk_grant_credits") {
      const delta = r2(Number(args.p_credit_delta || 0));
      if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 100000) throw new Error("Invalid amount.");
      const users = await db.collection("profiles").get();
      let changed = 0;
      const now = new Date().toISOString();
      for (const batch of Array.from({ length: Math.ceil(users.size / 200) }, (_, i) => users.docs.slice(i * 200, (i + 1) * 200))) {
        const write = db.batch();
        for (const user of batch) {
          const next = r2(Number(user.data().wallet_balance || 0) + delta);
          if (next < 0) continue;
          write.update(user.ref, { wallet_balance: next, updated_at: now });
          const ledger = db.collection("wallet_transactions").doc();
          write.set(ledger, { id: ledger.id, user_id: user.id, amount_inr: delta, balance_after: next, transaction_type: "admin_adjustment", description: String(args.p_reason || "Admin bulk adjustment"), created_at: now });
          changed++;
        }
        await write.commit();
      }
      return json({ data: changed });
    }

    if (name === "admin_assign_plan") {
      const userRef = db.collection("profiles").doc(String(args.p_target_user_id));
      const planSnap = await db.collection("premium_plans").doc(String(args.p_plan_id)).get();
      if (!planSnap.exists) throw new Error("Plan not found.");
      const plan = planSnap.data()!;
      await db.runTransaction(async tx => {
        const u = await tx.get(userRef); if (!u.exists) throw new Error("User not found.");
        const now = new Date().toISOString();
        const bonus = args.p_add_credits ? r2(Number(plan.credits || 0)) : 0;
        const balance = r2(Number(u.data()?.wallet_balance || 0) + bonus);
        tx.update(userRef, { plan_name: plan.name, plan_expires_at: new Date(Date.now() + Number(plan.duration_days || 30) * 86400000).toISOString(), wallet_balance: balance, updated_at: now });
        if (bonus > 0) {
          const ledger = db.collection("wallet_transactions").doc();
          tx.set(ledger, { id: ledger.id, user_id: userRef.id, amount_inr: bonus, balance_after: balance, transaction_type: "bonus", description: "Plan wallet bonus: " + plan.name, created_at: now });
        }
      });
      return json({ data: true });
    }

    return json({ error: "Unsupported operation." }, 400);
  } catch (e) { return json({ error: e instanceof Error ? e.message : "Request failed." }, 400); }
}
