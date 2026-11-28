import { NextResponse } from "next/server";
import { adminDb, verifyBearer } from "@/lib/firebase/admin";
import { chargeTool, refundCharge } from "@/lib/firebase/wallet";
import { getEnabledSupabaseTool } from "@/lib/supabase/rest";
export const runtime = "nodejs";
function safeTemplate(template: string) {
  if (!template.startsWith("https://") || (template.match(/\{\}/g) || []).length !== 1) throw new Error("Tool endpoint must be HTTPS and contain exactly one {} placeholder.");
  const url = new URL(template.replace("{}", "query"));
  const host = url.hostname.toLowerCase();
  if (url.username || url.password || url.port && url.port !== "443" || host === "localhost" || host.endsWith(".local") || host === "127.0.0.1" || host === "::1" || host.startsWith("10.") || host.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host === "169.254.169.254") throw new Error("Private network endpoints are blocked.");
  return url;
}
export async function POST(request: Request) {
  let refund: (() => Promise<unknown>) | null = null;
  try {
    const decoded = await verifyBearer(request);
    const { slug, query } = await request.json();
    const search = String(query || "").trim();
    if (!slug || !search || search.length > 500) return NextResponse.json({ error: "Enter a query between 1 and 500 characters." }, { status: 400 });
    const db = adminDb();
    const profile = await db.collection("profiles").doc(decoded.uid).get();
    if (!profile.exists || profile.data()?.status !== "active") return NextResponse.json({ error: "Account is not active." }, { status: 403 });
    const tool = await getEnabledSupabaseTool(String(slug));
    if (!tool) return NextResponse.json({ error: "Tool unavailable." }, { status: 404 });
    const config = tool.config && typeof tool.config === "object" ? tool.config as Record<string, unknown> : {};
    const template = String(config.api_url || "");
    safeTemplate(template);

    // Charge first (admin-set price per query). If the upstream call fails the charge is refunded.
    const charge = await chargeTool(db, decoded.uid, String(slug), tool);
    if (charge.chargeId) refund = () => refundCharge(db, decoded.uid, charge.chargeId);

    const response = await fetch(template.replace("{}", encodeURIComponent(search)), { redirect: "error", signal: AbortSignal.timeout(15000), headers: { Accept: "application/json, text/plain;q=0.9, */*;q=0.1" } });
    const raw = await response.text();
    if (raw.length > 1000000) throw new Error("API response exceeds 1 MB.");
    if (!response.ok) throw new Error("Configured API returned HTTP " + response.status);
    let result: unknown; try { result = JSON.parse(raw); } catch { result = { response: raw }; }
    return NextResponse.json({ ok: true, tool: tool.name, result, remaining_wallet: charge.balance, charged: charge.price });
  } catch (e) {
    if (refund) { try { await refund(); } catch {} }
    return NextResponse.json({ error: e instanceof Error ? e.message : "Tool request failed." }, { status: 400 });
  }
}
