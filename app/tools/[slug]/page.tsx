import Link from "next/link";
import {createClient} from "@/lib/supabase/server";
import ToolRunner from "./ToolRunner";
const builtIn=["ip-lookup","domain-lookup","dns-lookup","email-validator","phone-validator","url-safety","image-metadata"];
export default async function ToolPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 if(builtIn.includes(slug))return <ToolRunner slug={slug}/>;
 const db=await createClient();
 const {data:tool}=await db.from("tools").select("slug,name,description,category,credit_cost,enabled").eq("slug",slug).eq("enabled",true).maybeSingle();
 if(!tool)return <main className="panel-page"><h1>Tool not found</h1><Link href="/tools">Back to tools</Link></main>;
 return <main className="panel-page"><Link href="/tools">← All tools</Link><span className="eyebrow">{tool.category.toUpperCase()} · CUSTOM CATALOGUE ENTRY</span><h1>{tool.name}</h1><p>{tool.description||"This tool has been added to the catalogue."}</p><div className="auth-card"><h2>Tool setup required</h2><p>This entry is published in the tools catalogue, but it does not yet have a connected lookup implementation. Ask the site developer to add and test its provider integration before using it for live results.</p><p><b>Credit cost:</b> {tool.credit_cost}</p></div></main>;
}