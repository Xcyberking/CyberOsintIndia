import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json" },
});
function validateApiUrl(template: string): void {
  if (!template.startsWith("https://") || (template.match(/\{\}/g) || []).length !== 1) {
    throw new Error("Admin API URL must use HTTPS and contain exactly one {} query placeholder.");
  }
  const parsed = new URL(template.replace("{}", "query"));
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || (parsed.port && parsed.port !== "443")) {
    throw new Error("Only public HTTPS API endpoints on the standard port are supported.");
  }
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
      host === "127.0.0.1" || host === "::1" || host.startsWith("10.") ||
      host.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      host === "169.254.169.254" || host === "0.0.0.0") {
    throw new Error("Private or local network API hosts are blocked.");
  }
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Method not allowed." }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anon || !service) throw new Error("Supabase Edge Function environment is incomplete.");
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return reply({ error: "Sign in to use this tool." }, 401);
    const auth = createClient(url, anon, { global: { headers: { Authorization: "Bearer " + token } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await auth.auth.getUser(token);
    if (authError || !authData.user) return reply({ error: "Your session is invalid or expired." }, 401);
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile, error: profileError } = await admin.from("profiles").select("status").eq("id", authData.user.id).maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.status !== "active") return reply({ error: "Your account is not active." }, 403);
    const body = await req.json();
    const slug = String(body.slug || "").trim();
    const query = String(body.query || "").trim();
    if (!slug || !query || query.length > 500) return reply({ error: "Enter a query between 1 and 500 characters." }, 400);
    const { data: tool, error: toolError } = await admin.from("tools").select("slug,name,enabled,config").eq("slug", slug).maybeSingle();
    if (toolError) throw toolError;
    if (!tool || !tool.enabled) return reply({ error: "This tool is currently unavailable." }, 404);
    const config = tool.config && typeof tool.config === "object" ? tool.config as Record<string, unknown> : {};
    const template = String(config.api_url || "").trim();
    validateApiUrl(template);
    const target = template.replace("{}", encodeURIComponent(query));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let response: Response;
    try {
      response = await fetch(target, { method: "GET", headers: { Accept: "application/json, text/plain;q=0.9, */*;q=0.1" }, redirect: "error", signal: controller.signal });
    } finally { clearTimeout(timeout); }
    const raw = await response.text();
    if (raw.length > 1_000_000) return reply({ error: "API response is larger than the 1 MB limit." }, 502);
    let payload: unknown;
    try { payload = JSON.parse(raw); } catch { payload = { response: raw }; }
    if (!response.ok) return reply({ error: "Configured API returned HTTP " + response.status + ".", details: payload }, 502);
    const { data: remaining, error: creditError } = await auth.rpc("consume_tool_credit", { p_tool_slug: slug, p_query: query });
    if (creditError) return reply({ error: creditError.message }, creditError.message.includes("Insufficient") ? 402 : 400);
    return reply({ ok: true, tool: tool.name, result: payload, remaining_credits: remaining });
  } catch (error) {
    console.error("run-custom-tool error", error);
    return reply({ error: error instanceof Error ? error.message : "Unexpected API error." }, 500);
  }
});