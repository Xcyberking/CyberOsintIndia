import { NextResponse } from "next/server";
import { requireAdmin, adminDb } from "@/lib/firebase/admin";
import { supabaseRest } from "@/lib/supabase/rest";

export const runtime = "nodejs";

// One-time compatibility import: preserve administrator-created tools that were
// saved in Firestore before the Tools collection moved to Supabase.
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const [legacy, current] = await Promise.all([
      adminDb().collection("tools").get(),
      supabaseRest("/rest/v1/tools?select=slug")
    ]);
    const existing = new Set((Array.isArray(current.data) ? current.data : [])
      .map((row: unknown) => String((row as {slug?:unknown}).slug || "")));
    const rows: Record<string, unknown>[] = [];
    for (const doc of legacy.docs) {
      const source = doc.data() as Record<string, unknown>;
      const slug = String(source.slug || doc.id).trim().toLowerCase();
      if (!slug || existing.has(slug)) continue;
      const config = source.config && typeof source.config === "object" ? source.config as Record<string, unknown> : {};
      const apiUrl = String(config.api_url || source.api_url || "");
      let handler = String(source.handler || "custom");
      if (apiUrl) handler = "custom";
      if (!["ip","domain","dns","email","url","username","social","breach","image","custom"].includes(handler)) handler = "custom";
      rows.push({
        slug, name:String(source.name || source.title || slug),
        description:String(source.description || ""), category:String(source.category || "General"),
        enabled:source.enabled === true, handler, input_label:String(source.input_label || "Enter query"),
        result_note:String(source.result_note || ""), credit_cost:Math.max(0,Number(source.credit_cost || 0)),
        price_inr:Math.max(0,Number(source.price_inr ?? source.price ?? 0)), config,
        created_at:source.created_at || new Date().toISOString()
      });
      existing.add(slug);
    }
    if (rows.length) {
      await supabaseRest("/rest/v1/tools?on_conflict=slug", {
        method:"POST",
        headers:{"Prefer":"resolution=ignore-duplicates,return=representation"},
        body:JSON.stringify(rows)
      });
    }
    return NextResponse.json({ok:true,migrated:rows.length,checked:legacy.size});
  } catch (error) {
    const message=error instanceof Error?error.message:"Legacy tool migration failed.";
    return NextResponse.json({error:message},{status:/Administrator permission/.test(message)?403:400});
  }
}
