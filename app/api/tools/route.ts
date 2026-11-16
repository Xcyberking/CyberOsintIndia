import {NextResponse} from "next/server";
import {z} from "zod";
import {resolve4,resolve6,resolveMx,resolveTxt,resolveNs,resolveCaa,resolveSoa} from "node:dns/promises";
import {createClient} from "@/lib/supabase/server";
const inputSchema=z.object({tool:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60),input:z.string().trim().min(1).max(12000)});
const builtIn=["ip-lookup","domain-lookup","dns-lookup","email-validator","phone-validator","url-safety","image-metadata"];
function validPublicIp(s:string){return /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/.test(s)&&!/^(10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(s);}
const validDomain=(s:string)=>/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(s);
async function safeResolve<T>(fn:()=>Promise<T>){try{return await fn()}catch{return null}}
function replaceInput(template:string,input:string){return template.replaceAll("{{input_encoded}}",encodeURIComponent(input)).replaceAll("{{input}}",input).replaceAll("{{input_raw}}",input);}
function normalizeBody(value:any,depth=0):any{
 if(depth>7)return String(value);
 if(value===null||["string","number","boolean"].includes(typeof value))return value;
 if(Array.isArray(value))return value.slice(0,200).map(v=>normalizeBody(v,depth+1));
 if(typeof value==="object")return Object.fromEntries(Object.entries(value).slice(0,200).map(([k,v])=>[k,normalizeBody(v,depth+1)]));
 return String(value);
}
async function runCustomApi(supabase:any,tool:string,input:string){
 const {data:setting,error}=await supabase.from("site_settings").select("value").eq("key","tool_api_"+tool).maybeSingle();
 if(error||!setting?.value?.url)throw new Error("This tool API is not configured yet. Ask an admin to add its API endpoint.");
 const cfg=setting.value;const urlTemplate=String(cfg.url);
 let url=urlTemplate.replaceAll("{{input_encoded}}",encodeURIComponent(input)).replaceAll("{{input_raw}}",input).replaceAll("{{input}}",encodeURIComponent(input));
 if(url.includes("{}"))url=url.replace("{}",encodeURIComponent(input));
 if(!urlTemplate.includes("{{input")){const param=String(cfg.param_name||"query").replace(/[^a-zA-Z0-9_-]/g,"");const parsed=new URL(url);if(parsed.searchParams.has(param)&&!parsed.searchParams.get(param))parsed.searchParams.set(param,input);else if(!parsed.searchParams.has(param))parsed.searchParams.set(param,input);url=parsed.toString();}
 const target=new URL(url);if(!["https:","http:"].includes(target.protocol)||target.username||target.password)throw new Error("API URL must be a valid HTTP or HTTPS endpoint.");
 const host=target.hostname.toLowerCase();if(host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local")||host==="0.0.0.0"||host==="127.0.0.1"||host==="::1"||/^10\./.test(host)||/^192\.168\./.test(host)||/^172\.(1[6-9]|2\d|3[01])\./.test(host))throw new Error("Private or local API hosts are not allowed.");
 let headers:Record<string,string>={"Accept":"application/json, text/plain, application/xml, text/xml, */*"};
 try{const custom=JSON.parse(cfg.headers_json||"{}");if(!custom||Array.isArray(custom)||typeof custom!=="object")throw new Error();for(const [k,v] of Object.entries(custom)){if(!/^[a-zA-Z0-9-]{1,60}$/.test(k)||typeof v!=="string"||v.length>1000)throw new Error();headers[k]=v.replace(/\{\{env:([A-Z0-9_]+)\}\}/g,(_m,n)=>process.env[n]||"");}}catch{throw new Error("API headers must be a valid JSON object with string values.");}
 const method=cfg.method==="POST"?"POST":"GET";const init:RequestInit={method,headers,signal:AbortSignal.timeout(15000),cache:"no-store",redirect:"error"};
 if(method==="POST"){headers["Content-Type"]=cfg.content_type||"application/json";const body=replaceInput(String(cfg.body_template||'{"query":"{{input}}"}'),input);init.body=body;}
 const response=await fetch(target.toString(),init);const text=await response.text();if(text.length>1_000_000)throw new Error("API response is too large (maximum 1 MB).");
 let data:any=text;const contentType=response.headers.get("content-type")||"";
 if(contentType.includes("json")||/^[\s]*[\[{]/.test(text)){try{data=JSON.parse(text)}catch{/* preserve as text */}}
 if(!response.ok)throw new Error("API returned HTTP "+response.status+": "+(typeof data==="string"?data.slice(0,250):"Request failed"));
 return {data:normalizeBody(data),contentType,format:typeof data==="string"?"text":"structured",source:"configured-api"};
}
export async function POST(req:Request){
 const parsed=inputSchema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"Invalid tool input."},{status:400});
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Please log in."},{status:401});
 const {tool,input}=parsed.data;const summary=input.slice(0,120);let result:any;
 try{
  const {data:configuredApi}=await supabase.from("site_settings").select("key").eq("key","tool_api_"+tool).maybeSingle();
  if(configuredApi){const api=await runCustomApi(supabase,tool,input);result=api;}
  else if(!builtIn.includes(tool)){throw new Error("This tool has no API connection configured.");}
  else if(tool==="email-validator"){const [local,domain]=input.split("@");const ok=!!local&&!!domain&&/^[^\s@]+$/.test(local)&&/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain);result={valid:ok,syntax:ok?"valid":"invalid",note:"Syntax only; no mailbox probing."};}
  else if(tool==="phone-validator"){const clean=input.replace(/[\s()-]/g,"");const ok=/^\+[1-9]\d{7,14}$/.test(clean);result={valid:ok,normalized:ok?clean:null,note:"Format only; no subscriber identity or location is retrieved."};}
  else if(tool==="domain-lookup"||tool==="dns-lookup"){const host=input.toLowerCase().replace(/^https?:\/\//,"").split("/")[0];if(!validDomain(host))return NextResponse.json({error:"Enter a valid public domain name."},{status:400});const [a,aaaa,mx,txt,ns,caa,soa]=await Promise.all([safeResolve(()=>resolve4(host)),safeResolve(()=>resolve6(host)),safeResolve(()=>resolveMx(host)),safeResolve(()=>resolveTxt(host)),safeResolve(()=>resolveNs(host)),safeResolve(()=>resolveCaa(host)),safeResolve(()=>resolveSoa(host))]);result={domain:host,records:{A:a,AAAA:aaaa,MX:mx,TXT:txt,NS:ns,CAA:caa,SOA:soa},note:"Public DNS records. Missing record types are returned as null."};}
  else if(tool==="ip-lookup"){if(!validPublicIp(input))return NextResponse.json({error:"Enter a public IPv4 address."},{status:400});const response=await fetch("https://ipwho.is/"+encodeURIComponent(input),{signal:AbortSignal.timeout(8000),cache:"no-store"});if(!response.ok)throw new Error("IP data provider unavailable");const data=await response.json();if(data.success===false)throw new Error(data.message||"Lookup failed");result={ip:data.ip,country:data.country,region:data.region,city:data.city,timezone:data.timezone?.id,connection:{isp:data.connection?.isp,asn:data.connection?.asn},note:"Approximate public IP metadata; not a precise address or person identifier."};}
  else if(tool==="url-safety"){const u=new URL(input);if(!["http:","https:"].includes(u.protocol))return NextResponse.json({error:"Only HTTP and HTTPS URLs are accepted."},{status:400});result={url:u.toString(),hostname:u.hostname,https:u.protocol==="https:",userinfoPresent:!!(u.username||u.password),note:"Basic URL structure only; not a malware verdict."};}
  else if(tool==="image-metadata"){const img=JSON.parse(input);if(!img||typeof img!=="object"||typeof img.fileName!=="string"||!img.metadata||typeof img.metadata!=="object")return NextResponse.json({error:"Invalid image metadata payload."},{status:400});const keys=new Set(["Make","Model","DateTimeOriginal","CreateDate","ModifyDate","Orientation","ImageWidth","ImageHeight","ExifImageWidth","ExifImageHeight","Software","LensModel","FNumber","ExposureTime","ISO","FocalLength","Flash","WhiteBalance","ColorSpace","MIMEType"]);result={fileName:img.fileName,fileSize:img.fileSize,mimeType:img.mimeType,metadata:Object.fromEntries(Object.entries(img.metadata).filter(([k,v])=>keys.has(k)&&["string","number","boolean"].includes(typeof v))),note:"GPS/location data and device serial identifiers are excluded."};}
  const {data:billing,error:billingError}=await supabase.rpc("consume_tool_credit",{p_tool_slug:tool});if(billingError)throw new Error(billingError.message);
  const {error:historyError}=await supabase.from("search_history").insert({user_id:user.id,tool_slug:tool,input_summary:summary,status:"success"});if(historyError)throw new Error("Could not save search history");
  return NextResponse.json({result,creditsCharged:billing?.charged??0,remainingCredits:billing?.balance??null,adminUnlimited:billing?.admin_unlimited??false});
 }catch(e){await supabase.from("search_history").insert({user_id:user.id,tool_slug:tool,input_summary:summary,status:"error"});return NextResponse.json({error:e instanceof Error?e.message:"Lookup failed."},{status:502});}
}
