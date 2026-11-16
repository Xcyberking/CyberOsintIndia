import Link from "next/link";
import {createClient} from "@/lib/supabase/server";
import {Globe2,Mail,Phone,Search,Database,Image,ShieldCheck,Wrench} from "lucide-react";
const icons:Record<string,any>={"ip-lookup":Globe2,"email-validator":Mail,"phone-validator":Phone,"domain-lookup":Search,"dns-lookup":Database,"image-metadata":Image,"url-safety":ShieldCheck};
export default async function Tools(){
 const supabase=await createClient();
 const {data:items}=await supabase.from("tools").select("slug,name,description,category,credit_cost,enabled").eq("enabled",true).order("name");
 return <main className="panel-page"><Link href="/">← Home</Link><span className="eyebrow">RESEARCH WORKSPACE</span><h1>Explore <em>Tools</em></h1><p>Public-information utilities for ethical research and authorized security work.</p><div className="grid">{(items||[]).map(t=>{const Icon=icons[t.slug]||Wrench;return <Link className="card" href={"/tools/"+t.slug} key={t.slug}><span className="icon"><Icon/></span><span><b>{t.name}</b><small>{t.description||t.category}</small><label>{t.credit_cost} CREDIT{t.credit_cost===1?"":"S"} · OPEN TOOL</label></span></Link>;})}</div>{!items?.length&&<p>No tools are currently available.</p>}</main>;
}