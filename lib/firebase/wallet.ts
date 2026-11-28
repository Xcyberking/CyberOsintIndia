import "server-only";
import type { Firestore } from "firebase-admin/firestore";

export const r2 = (n: number) => Math.round(n * 100) / 100;

export async function findTool(db: Firestore, slug: string) {
  const snap = await db.collection("tools").where("slug", "==", slug).limit(1).get();
  if (snap.empty || snap.docs[0].data().enabled !== true) throw new Error("Tool is unavailable.");
  return snap.docs[0].data();
}

// Read-only: can this user afford one query of this tool?
export async function walletStatus(db: Firestore, uid: string, slug: string) {
  const tool = await findTool(db, slug);
  const price = r2(Math.max(0, Number(tool.price_inr || 0)));
  const snap = await db.collection("profiles").doc(uid).get();
  const p = snap.data();
  if (!snap.exists || p?.status !== "active") throw new Error("Account is not active.");
  const balance = r2(Number(p.wallet_balance || 0));
  const free = p.role === "admin" || price === 0;
  return { ok: free || balance >= price, price: free ? 0 : price, balance, free };
}

// Atomically deduct the admin-set price of one query from the user's wallet.
export async function chargeTool(db: Firestore, uid: string, slug: string, toolOverride?: any) {
  const tool = toolOverride || await findTool(db, slug);
  const price = r2(Math.max(0, Number(tool.price_inr || 0)));
  const ref = db.collection("profiles").doc(uid);
  let result = { balance: 0, chargeId: "", price, free: false };
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const p = snap.data();
    if (!snap.exists || p?.status !== "active") throw new Error("Account is not active.");
    const current = r2(Number(p.wallet_balance || 0));
    if (p.role === "admin" || price === 0) { result = { balance: current, chargeId: "", price: 0, free: true }; return; }
    if (current < price) throw new Error("Insufficient wallet balance. Required ₹" + price.toFixed(2) + ", available ₹" + current.toFixed(2) + ". Please deposit money to continue.");
    const balance = r2(current - price);
    const now = new Date().toISOString();
    const ledger = db.collection("wallet_transactions").doc();
    tx.update(ref, { wallet_balance: balance, updated_at: now });
    tx.set(ledger, { id: ledger.id, user_id: uid, amount_inr: -price, balance_after: balance, transaction_type: "tool_usage", description: "Tool query: " + (tool.name || slug), tool_slug: slug, created_at: now });
    result = { balance, chargeId: ledger.id, price, free: false };
  });
  return result;
}

// Server-side only (used when a charged query fails before returning a result).
export async function refundCharge(db: Firestore, uid: string, chargeId: string) {
  if (!chargeId) return null;
  const ledgerRef = db.collection("wallet_transactions").doc(chargeId);
  const ref = db.collection("profiles").doc(uid);
  let balance = 0;
  await db.runTransaction(async tx => {
    const l = await tx.get(ledgerRef);
    const p = await tx.get(ref);
    const d = l.data();
    if (!l.exists || d?.user_id !== uid || d?.transaction_type !== "tool_usage" || d?.refunded === true) throw new Error("Charge cannot be refunded.");
    const amount = r2(Math.abs(Number(d.amount_inr || 0)));
    const now = new Date().toISOString();
    balance = r2(Number(p.data()?.wallet_balance || 0) + amount);
    tx.update(ref, { wallet_balance: balance, updated_at: now });
    tx.update(ledgerRef, { refunded: true });
    const rl = db.collection("wallet_transactions").doc();
    tx.set(rl, { id: rl.id, user_id: uid, amount_inr: amount, balance_after: balance, transaction_type: "refund", description: "Refund: " + String(d.description || "failed query"), refund_of: chargeId, created_at: now });
  });
  return balance;
}
