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
 const slug=String(form.get("slug")||"").trim().toLowerCase();
 const name=String(form.get("name")||"").trim().slice(0,80);
 const description=String(form.get("description")||"").trim().slice(0,240);
 const category=String(form.get("category")||"General").trim().slice(0,40)||"General";
 const creditCost=Number(form.get("credit_cost"));
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>60)throw new Error("Slug must use lowercase letters, numbers and hyphens");
 if(name.length<2||!Number.isInteger(creditCost)||creditCost<0||creditCost>1000)throw new Error("Invalid tool details");
 const {error}=await supabase.from("tools").insert({slug,name,description,category,credit_cost:creditCost,enabled:form.get("enabled")==="on"});
 if(error)throw new Error(error.message);
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
