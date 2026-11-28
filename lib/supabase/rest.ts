import "server-only";

const DEFAULT_URL = "https://pwwwoppmhefscguajzwc.supabase.co";

export function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || DEFAULT_URL).replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY. Add the Supabase server secret to Vercel Environment Variables.");
  return { url, key };
}

export async function supabaseRest(path: string, init: RequestInit = {}) {
  const { url, key } = supabaseConfig();
  const headers = new Headers(init.headers || {});
  headers.set("apikey", key);
  headers.set("Authorization", "Bearer " + key);
  if (init.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(url + path, { ...init, headers, cache: "no-store" });
  const raw = await response.text();
  let data: unknown = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) {
    const detail = data && typeof data === "object" && "message" in data ? String((data as {message:unknown}).message) : raw || response.statusText;
    throw new Error("Supabase request failed (" + response.status + "): " + detail);
  }
  return { data, response };
}

export async function getEnabledSupabaseTool(slug: string) {
  const query = new URLSearchParams({ select: "*", slug: "eq." + slug, enabled: "eq.true", limit: "1" });
  const { data } = await supabaseRest("/rest/v1/tools?" + query.toString());
  return Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) || null : null;
}
