import { NextResponse } from "next/server";
import { requireAdmin, verifyBearer } from "@/lib/firebase/admin";
import { supabaseRest } from "@/lib/supabase/rest";

export const runtime = "nodejs";
const TABLES = new Set(["tools", "site_settings"]);
const PUBLIC_SETTINGS = ["payment_qr_url", "payment_upi_id", "payment_instructions", "default_signup_credits", "referral_new_user_credits", "referral_reward"];

type Filter = { field: string; op: "eq" | "neq" | "in" | "ilike"; value: unknown };
type Body = {
  table?: string; action?: "select" | "insert" | "upsert" | "update" | "delete";
  columns?: string; filters?: Filter[]; order?: {field:string;dir:"asc"|"desc"}[];
  limit?: number; opts?: {head?:boolean;count?:string;onConflict?:string};
  payload?: Record<string, unknown> | Record<string, unknown>[];
};

function cleanPayload(table: string, payload: Body["payload"]) {
  const rows = (Array.isArray(payload) ? payload : [payload || {}]).map((row) => {
    const copy = { ...row };
    if (table === "site_settings") delete copy.updated_by; // Firebase UIDs are not Supabase Auth UUIDs.
    if (table === "tools" && !copy.id) delete copy.id; // Let Postgres generate the UUID primary key.
    return copy;
  });
  return Array.isArray(payload) ? rows : rows[0];
}
function applyFilters(params: URLSearchParams, filters: Filter[] = []) {
  for (const filter of filters) {
    if (!filter?.field || !["eq","neq","in","ilike"].includes(filter.op)) continue;
    const value = filter.op === "in"
      ? "in.(" + (Array.isArray(filter.value) ? filter.value : []).map(v => String(v).replace(/[(),"]/g, "")).join(",") + ")"
      : filter.op === "ilike" ? "ilike.*" + String(filter.value || "").replace(/[,*]/g, "") + "*"
      : filter.op + "." + String(filter.value ?? "");
    params.set(filter.field, value);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Body;
    const table = String(body.table || "");
    const action = body.action || "select";
    if (!TABLES.has(table)) return NextResponse.json({error:"This data collection is not available through this endpoint."},{status:400});
    const isWrite = action !== "select";
    let decoded = isWrite ? await requireAdmin(request) : await verifyBearer(request);
    if (!isWrite && decoded.admin === true) decoded = await requireAdmin(request);
    const isAdmin = decoded.admin === true;
    if (isWrite && !isAdmin) return NextResponse.json({error:"Administrator permission required."},{status:403});

    const params = new URLSearchParams();
    params.set("select", body.columns && body.columns !== "*" ? body.columns : "*");
    applyFilters(params, body.filters || []);
    if (table === "tools" && !isAdmin) params.set("enabled", "eq.true");
    if (table === "site_settings" && !isAdmin) {
      params.set("key", "in.(" + PUBLIC_SETTINGS.join(",") + ")");
    }
    if (body.order?.length) params.set("order", body.order.map(s => s.field + "." + (s.dir === "desc" ? "desc" : "asc")).join(","));
    if (Number.isSafeInteger(body.limit) && Number(body.limit) > 0) params.set("limit", String(Math.min(Number(body.limit), 500)));

    let method = "GET";
    let path = "/rest/v1/" + table + "?" + params.toString();
    const headers = new Headers();
    headers.set("Prefer", body.opts?.count === "exact" ? "count=exact" : "return=representation");
    if (body.opts?.head && action === "select") method = "HEAD";
    if (action === "insert" || action === "upsert") {
      method = "POST";
      if (action === "upsert" && body.opts?.onConflict) params.set("on_conflict", body.opts.onConflict);
      path = "/rest/v1/" + table + "?" + params.toString();
      if (action === "upsert") headers.set("Prefer", "resolution=merge-duplicates,return=representation");
    } else if (action === "update") method = "PATCH";
    else if (action === "delete") method = "DELETE";
    else if (action !== "select") return NextResponse.json({error:"Unsupported data action."},{status:400});

    const payload = isWrite ? cleanPayload(table, body.payload) : undefined;
    const {data,response} = await supabaseRest(path, {
      method, headers,
      ...(payload !== undefined ? {body:JSON.stringify(payload)} : {})
    });
    const range = response.headers.get("content-range");
    const count = range && range.includes("/") && range.split("/")[1] !== "*" ? Number(range.split("/")[1]) : Array.isArray(data) ? data.length : null;
    return NextResponse.json({data:body.opts?.head ? null : data,count,error:null});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Supabase data request failed.";
    const status = /Administrator permission|required|Verify your email|Sign in/.test(message) ? 403 : 400;
    return NextResponse.json({data:null,error:{message},count:null},{status});
  }
}
