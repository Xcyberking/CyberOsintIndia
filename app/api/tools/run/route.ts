import { NextResponse } from "next/server";
import { adminDb, verifyBearer } from "@/lib/firebase/admin";
export const runtime = "nodejs";
function safeTemplate(template: string) {
  if (!template.startsWith("https://") || (template.match(/\{\}/g) || []).length !== 1) throw new Error("Tool endpoint must be HTTPS and contain exactly one {} placeholder.");
  const url = new URL(template.replace("{}", "query"));
  const host = url.hostname.toLowerCase();
  if (url.username || url.password || url.port && url.port !== "443" || host === "localhost" || host.endsWith(".local") || host === "127.0.0.1" || host === "::1" || host.startsWith("10.") || host.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host === "169.254.169.254") throw new Error("Private network endpoints are blocked.");
  return url;
}
export async function POST(request: Request) {
  try {
    const decoded = await verifyBearer(request);
    const { slug, query } = await request.json();
    const search = String(query || "").trim();
    if (!slug || !search || search.length > 500) return NextResponse.json({ error: "Enter a query between 1 and 500 characters." }, { status: 400 });
    const db = adminDb();
    const profile = await db.collection("profiles").doc(decoded.uid).get();
    if (!profile.exists || profile.data()?.status !== "active") return NextResponse.json({ error: "Account is not active." }, { status: 403 });
    const snap = await db.collection("tools").where("slug", "==", String(slug)).limit(1).get();
    if (snap.empty || snap.docs[0].data().enabled !== true) return NextResponse.json({ error: "Tool unavailable." }, { status: 404 });
    const tool = snap.docs[0].data();
    const template = String(tool.config?.api_url || "");
    const target = safeTemplate(template);
    const response = await fetch(template.replace("{}", encodeURIComponent(search)), { redirect: "error", signal: AbortSignal.timeout(15000), headers: { Accept: "application/json, text/plain;q=0.9, */*;q=0.1" } });
    const raw = await response.text();
    if (raw.length > 1000000) return NextResponse.json({ error: "API response exceeds 1 MB." }, { status: 502 });
    if (!response.ok) return NextResponse.json({ error: "Configured API returned HTTP " + response.status }, { status: 502 });
    let result: unknown; try { result = JSON.parse(raw); } catch { result = { response: raw }; }
    const rpc = await fetch(new URL("/api/firebase/rpc", request.url), { method: "POST", headers: { Authorization: request.headers.get("authorization") || "", "Content-Type": "application/json" }, body: JSON.stringify({ name: "consume_tool_wallet", args: { p_tool_slug: slug } }) });
    const balance = await rpc.json(); if (!rpc.ok) return NextResponse.json({ error: balance.error || "Wallet charge failed." }, { status: rpc.status });
    return NextResponse.json({ ok: true, tool: tool.name, result, remaining_wallet: balance.data });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Tool request failed." }, { status: 400 }); }
}
