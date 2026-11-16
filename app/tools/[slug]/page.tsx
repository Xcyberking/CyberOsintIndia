import Link from "next/link";
import {createClient} from "@/lib/supabase/server";
import ToolRunner from "./ToolRunner";
import CustomToolRunner from "./CustomToolRunner";
const builtIn=["ip-lookup","domain-lookup","dns-lookup","email-validator","phone-validator","url-safety","image-metadata"];
export default async function ToolPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;const db=await createClient();
 const {data:config}=await db.from("site_settings").select("key").eq("key","tool_api_"+slug).maybeSingle();
 const {data:tool}=await db.from("tools").select("slug,name,description,category,credit_cost,enabled").eq("slug",slug).eq("enabled",true).maybeSingle();
 if(config&&tool)return <CustomToolRunner slug={slug} title={tool.name} description={tool.description} creditCost={tool.credit_cost}/>;
 if(builtIn.includes(slug))return <ToolRunner slug={slug}/>;
 if(!tool)return <main className="panel-page"><h1>Tool not found</h1><Link href="/tools">Back to tools</Link></main>;
 return <main className="panel-page"><Link href="/tools">← All tools</Link><span className="eyebrow">{tool.category.toUpperCase()} · API SETUP REQUIRED</span><h1>{tool.name}</h1><p>{tool.description||"This tool has been added to the catalogue."}</p><div className="auth-card"><h2>Connect an API</h2><p>An admin must configure this tool's API endpoint from Admin → Tool management before users can run it.</p><p><b>Credit cost:</b> {tool.credit_cost}</p></div></main>;
}