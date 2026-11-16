"use server";
import {revalidatePath} from "next/cache";
import {requireAdmin} from "@/lib/auth";

export async function adjustCredits(form:FormData){
 const {supabase}=await requireAdmin();
 const userId=String(form.get("user_id")||"");
 const amount=Number(form.get("amount"));
 const reason=String(form.get("reason")||"Admin adjustment").trim().slice(0,160);
 if(!userId||!Number.isInteger(amount)||amount===0||Math.abs(amount)>10000)throw new Error("Invalid adjustment");
 const {error}=await supabase.rpc("admin_adjust_credits",{p_user_id:userId,p_amount:amount,p_reason:reason||"Admin adjustment"});
 if(error)throw new Error(error.message);
 revalidatePath("/admin");revalidatePath("/admin/users");revalidatePath("/credits");
}
export async function setUserRole(form:FormData){
 const {supabase}=await requireAdmin();
 const userId=String(form.get("user_id")||"");
 const role=String(form.get("role")||"");
 if(!userId||!["user","admin"].includes(role))throw new Error("Invalid user role");
 const {error}=await supabase.rpc("admin_set_user_role",{p_user_id:userId,p_role:role});
 if(error)throw new Error(error.message);
 revalidatePath("/admin");revalidatePath("/admin/users");
}
export async function createTool(form:FormData){
 const {supabase}=await requireAdmin();
 const name=String(form.get("name")||"").trim().slice(0,80);
 const slug=name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60);
 const apiUrl=String(form.get("api_url")||"").trim();
 const description=String(form.get("description")||"").trim().slice(0,240);
 const category=String(form.get("category")||"General").trim().slice(0,40)||"General";
 const creditCost=Number(form.get("credit_cost"));
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>60)throw new Error("Slug must use lowercase letters, numbers and hyphens");
 if(name.length<2||!slug||!apiUrl||apiUrl.length>2000||!Number.isInteger(creditCost)||creditCost<0||creditCost>1000)throw new Error("Enter a tool name, API URL and valid credit cost.");
 let parsedUrl:URL;try{parsedUrl=new URL(apiUrl.replaceAll("{{input}}","demo").replaceAll("{{input_encoded}}","demo").replaceAll("{{input_raw}}","demo").replaceAll("{}","demo"));}catch{throw new Error("Enter a valid API URL. Use {} where the user input should be inserted.");}
 if(!["http:","https:"].includes(parsedUrl.protocol)||parsedUrl.username||parsedUrl.password)throw new Error("API URL must use HTTP or HTTPS without embedded credentials.");
 const {error}=await supabase.from("tools").insert({slug,name,description:"",category:"Custom",credit_cost:creditCost,enabled:true});
 if(error)throw new Error(error.message);
 const config={url:apiUrl,method:"GET",param_name:"query",headers_json:"{}",body_template:"",content_type:"application/json",configured_at:new Date().toISOString()};
 const {error:configError}=await supabase.from("site_settings").upsert({key:"tool_api_"+slug,value:config,updated_at:new Date().toISOString()});
 if(configError){await supabase.from("tools").delete().eq("slug",slug);throw new Error(configError.message);}
 revalidatePath("/admin/tools");revalidatePath("/tools");revalidatePath("/admin");
}
export async function updateTool(form:FormData){
 const {supabase}=await requireAdmin();
 const slug=String(form.get("slug")||"");
 const name=String(form.get("name")||"").trim().slice(0,80);
 const description=String(form.get("description")||"").trim().slice(0,240);
 const category=String(form.get("category")||"General").trim().slice(0,40)||"General";
 const creditCost=Number(form.get("credit_cost"));
 const enabled=form.get("enabled")==="on";
 if(!slug||name.length<2||!Number.isInteger(creditCost)||creditCost<0||creditCost>1000)throw new Error("Invalid tool settings");
 const {error}=await supabase.from("tools").update({name,description,category,credit_cost:creditCost,enabled}).eq("slug",slug);
 if(error)throw new Error(error.message);
 revalidatePath("/admin/tools");revalidatePath("/tools");revalidatePath("/admin");
}
export async function deleteTool(form:FormData){
 const {supabase}=await requireAdmin();
 const slug=String(form.get("slug")||"");
 if(!slug)throw new Error("Missing tool slug");
 const {error}=await supabase.from("tools").delete().eq("slug",slug);
 if(error)throw new Error(error.message);
 revalidatePath("/admin/tools");revalidatePath("/tools");revalidatePath("/admin");
}

export async function saveToolApi(form:FormData){
 const {supabase}=await requireAdmin();
 const slug=String(form.get("slug")||"").trim().toLowerCase();
 const url=String(form.get("url")||"").trim();
 const method=String(form.get("method")||"GET").toUpperCase();
 const paramName=String(form.get("param_name")||"query").trim().slice(0,60);
 const headersJson=String(form.get("headers_json")||"{}").trim();
 const bodyTemplate=String(form.get("body_template")||"").slice(0,12000);
 const contentType=String(form.get("content_type")||"application/json").trim().slice(0,100);
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||!url||url.length>2000||!["GET","POST"].includes(method))throw new Error("Invalid API configuration");
 let parsedUrl:URL;try{parsedUrl=new URL(url.replaceAll("{{input}}","demo").replaceAll("{{input_encoded}}","demo").replaceAll("{{input_raw}}","demo"));}catch{throw new Error("Enter a valid API URL.");}
 if(!["http:","https:"].includes(parsedUrl.protocol)||parsedUrl.username||parsedUrl.password)throw new Error("API URL must use HTTP or HTTPS without embedded credentials.");
 let headers:any;try{headers=JSON.parse(headersJson);if(!headers||Array.isArray(headers)||typeof headers!=="object"||Object.values(headers).some(v=>typeof v!=="string"))throw new Error();}catch{throw new Error("Headers must be a JSON object with string values.");}
 const value={url,method,param_name:paramName||"query",headers_json:JSON.stringify(headers),body_template:bodyTemplate,content_type:contentType,configured_at:new Date().toISOString()};
 const {error}=await supabase.from("site_settings").upsert({key:"tool_api_"+slug,value,updated_at:new Date().toISOString()});
 if(error)throw new Error(error.message);
 revalidatePath("/admin/tools");revalidatePath("/tools");revalidatePath("/tools/"+slug);
}
