import {NextResponse} from "next/server";
import {createClient as createSupabaseClient} from "@supabase/supabase-js";
export const runtime="nodejs";
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret || request.headers.get("authorization")!==`Bearer ${secret}`) return NextResponse.json({error:"Unauthorized"},{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key) return NextResponse.json({error:"Supabase server configuration missing"},{status:503});
 const db=createSupabaseClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const checks: {service:string;status:"online"|"degraded"|"offline";latency_ms:number;details:string}[]=[];
 const started=Date.now();
 try{
  const r=await fetch("https://ipwho.is/8.8.8.8",{cache:"no-store",signal:AbortSignal.timeout(7000)});
  checks.push({service:"IP metadata provider",status:r.ok?"online":"degraded",latency_ms:Date.now()-started,details:`HTTP ${r.status}`});
 }catch(e){checks.push({service:"IP metadata provider",status:"offline",latency_ms:Date.now()-started,details:e instanceof Error?e.message:"Probe failed"});}
 const dnsStart=Date.now();
 try{
  const r=await fetch("https://dns.google/resolve?name=example.com&type=A",{cache:"no-store",signal:AbortSignal.timeout(7000)});
  const j=await r.json();
  checks.push({service:"Public DNS-over-HTTPS",status:r.ok&&Array.isArray(j.Answer)?"online":"degraded",latency_ms:Date.now()-dnsStart,details:r.ok?"Probe completed":`HTTP ${r.status}`});
 }catch(e){checks.push({service:"Public DNS-over-HTTPS",status:"offline",latency_ms:Date.now()-dnsStart,details:e instanceof Error?e.message:"Probe failed"});}
 const {error}=await db.from("health_checks").insert(checks);
 if(error) return NextResponse.json({checks,error:"Could not persist health results"},{status:500});
 return NextResponse.json({checkedAt:new Date().toISOString(),checks});
}
