import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}
async function encryptionKey(): Promise<CryptoKey> {
  const master = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!master) throw new Error("Supabase service role secret is not configured for Edge Functions.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("CyberOsintIndia Razorpay vault v1:" + master));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
async function encryptSecret(secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), new TextEncoder().encode(secret));
  return { encrypted_secret: toBase64(new Uint8Array(encrypted)), iv: toBase64(iv) };
}
async function decryptSecret(encrypted: string, iv: string): Promise<string> {
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, await encryptionKey(), fromBase64(encrypted));
  return new TextDecoder().decode(clear);
}
async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
  return [...signature].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function razorpayConfig(admin: ReturnType<typeof createClient>, includeSecret = false) {
  const { data, error } = await admin.from("payment_gateway_secrets").select("*").eq("id", "razorpay").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Razorpay is not configured by the administrator.");
  const secret = includeSecret ? await decryptSecret(data.encrypted_secret, data.iv) : undefined;
  return { keyId: data.key_id as string, enabled: Boolean(data.enabled), secret };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) throw new Error("Supabase Edge Function environment is incomplete.");
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Authentication required." }, 401);
    const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Your session is invalid or expired." }, 401);
    const user = authData.user;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile, error: profileError } = await admin.from("profiles").select("role,status").eq("id", user.id).maybeSingle();
    if (profileError) throw profileError;
    const isAdmin = profile?.role === "admin" && profile?.status === "active";
    const body = await req.json();
    const action = String(body.action || "");

    if (action === "save_config") {
      if (!isAdmin) return json({ error: "Administrator access required." }, 403);
      const keyId = String(body.key_id || "").trim();
      const keySecret = String(body.key_secret || "").trim();
      const enabled = Boolean(body.enabled);
      const { data: existing, error: existingError } = await admin.from("payment_gateway_secrets").select("encrypted_secret,iv").eq("id", "razorpay").maybeSingle();
      if (existingError) throw existingError;
      if (keyId && !/^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId)) return json({ error: "Enter a valid Razorpay Key ID (rzp_test_… or rzp_live_…)."}, 400);
      let encrypted = existing?.encrypted_secret;
      let iv = existing?.iv;
      if (keySecret) {
        if (keySecret.length < 8) return json({ error: "Razorpay Key Secret looks too short." }, 400);
        const result = await encryptSecret(keySecret);
        encrypted = result.encrypted_secret;
        iv = result.iv;
      }
      if (!keyId && !existing) return json({ error: "Razorpay Key ID is required." }, 400);
      if (!encrypted || !iv) return json({ error: "Razorpay Key Secret is required for the first setup." }, 400);
      const payload = { id: "razorpay", key_id: keyId || (await razorpayConfig(admin)).keyId, encrypted_secret: encrypted, iv, enabled, updated_at: new Date().toISOString() };
      const { error } = await admin.from("payment_gateway_secrets").upsert(payload, { onConflict: "id" });
      if (error) throw error;
      return json({ ok: true, enabled, key_id: payload.key_id, secret_saved: true });
    }

    if (action === "public_config") {
      const config = await razorpayConfig(admin);
      return json({ enabled: config.enabled, key_id: config.keyId });
    }

    if (action === "create_order") {
      const config = await razorpayConfig(admin, true);
      if (!config.enabled || !config.secret) return json({ error: "Online payments are currently disabled." }, 409);
      const planId = String(body.plan_id || "");
      const { data: plan, error: planError } = await admin.from("premium_plans").select("id,name,description,price_inr,credits,duration_days,is_active").eq("id", planId).eq("is_active", true).maybeSingle();
      if (planError) throw planError;
      if (!plan || Number(plan.price_inr) <= 0) return json({ error: "Selected plan is unavailable." }, 404);
      const amount = Math.round(Number(plan.price_inr) * 100);
      const receipt = "cx_" + crypto.randomUUID().replaceAll("-", "").slice(0, 24);
      const credentials = btoa(config.keyId + ":" + config.secret);
      const orderResponse = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { Authorization: "Basic " + credentials, "Content-Type": "application/json" },
        body: JSON.stringify({ amount, currency: "INR", receipt, notes: { user_id: user.id, plan_id: plan.id, app: "CyberOsintIndia" } }),
      });
      const order = await orderResponse.json();
      if (!orderResponse.ok || !order.id) return json({ error: order.error?.description || "Razorpay could not create the payment order." }, 502);
      const { data: payment, error: paymentError } = await admin.from("payment_records").insert({
        user_id: user.id, plan_id: plan.id, provider: "razorpay", provider_reference: order.id,
        amount_inr: plan.price_inr, status: "pending", user_note: "Razorpay order " + order.id,
      }).select("id").single();
      if (paymentError) throw paymentError;
      return json({ order_id: order.id, payment_record_id: payment.id, amount, currency: "INR", key_id: config.keyId, name: "CyberX OSINT", description: plan.name });
    }

    if (action === "verify_payment") {
      const orderId = String(body.razorpay_order_id || "");
      const paymentId = String(body.razorpay_payment_id || "");
      const signature = String(body.razorpay_signature || "");
      const paymentRecordId = String(body.payment_record_id || "");
      if (!orderId || !paymentId || !signature || !paymentRecordId) return json({ error: "Payment verification fields are incomplete." }, 400);
      const config = await razorpayConfig(admin, true);
      if (!config.secret) throw new Error("Razorpay secret is unavailable.");
      const expected = await hmacHex(config.secret, orderId + "|" + paymentId);
      if (!safeEqual(expected, signature)) return json({ error: "Razorpay signature verification failed." }, 400);
      const { data: record, error: recordError } = await admin.from("payment_records").select("id,user_id,provider,provider_reference,amount_inr,status").eq("id", paymentRecordId).eq("user_id", user.id).maybeSingle();
      if (recordError) throw recordError;
      if (!record || record.provider !== "razorpay" || record.provider_reference !== orderId) return json({ error: "Payment order does not match this account." }, 403);
      if (record.status === "success") return json({ ok: true, already_processed: true });
      const credentials = btoa(config.keyId + ":" + config.secret);
      const paymentResponse = await fetch("https://api.razorpay.com/v1/payments/" + encodeURIComponent(paymentId), { headers: { Authorization: "Basic " + credentials } });
      const remotePayment = await paymentResponse.json();
      if (!paymentResponse.ok || remotePayment.order_id !== orderId || remotePayment.status !== "captured" || Number(remotePayment.amount) !== Math.round(Number(record.amount_inr) * 100) || remotePayment.currency !== "INR") {
        return json({ error: "Razorpay payment is not captured or does not match the order amount." }, 409);
      }
      const { data: completed, error: completeError } = await admin.rpc("complete_razorpay_payment", {
        p_payment_record_id: paymentRecordId, p_user_id: user.id, p_payment_id: paymentId, p_signature: signature,
      });
      if (completeError) throw completeError;
      return json({ ok: true, result: completed });
    }
    return json({ error: "Unknown action." }, 400);
  } catch (error) {
    console.error("payment-gateway error", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected payment gateway error." }, 500);
  }
});