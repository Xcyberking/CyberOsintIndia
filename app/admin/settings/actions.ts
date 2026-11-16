"use server";
import {revalidatePath} from "next/cache";
import {requireAdmin} from "@/lib/auth";

export async function saveContactSettings(form:FormData){
 const {supabase}=await requireAdmin();
 const keys=["email","telegram","whatsapp","github","instagram","youtube"] as const;
 const value:Record<string,string>={};
 for(const key of keys){
  const raw=String(form.get(key)||"").trim();
  if(raw.length>250) throw new Error("Contact field is too long");
  if(raw && key==="email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) throw new Error("Invalid email address");
  if(raw && ["telegram","whatsapp","github","instagram","youtube"].includes(key) && !/^https:\/\//i.test(raw)) throw new Error("Contact links must use HTTPS");
  value[key]=raw;
 }
 const {error}=await supabase.from("site_settings").upsert({key:"contact",value,updated_at:new Date().toISOString()});
 if(error) throw new Error(error.message);
 revalidatePath("/admin/settings");revalidatePath("/");
}
export async function createAnnouncement(form:FormData){
 const {supabase}=await requireAdmin();
 const title=String(form.get("title")||"").trim().slice(0,100);
 const body=String(form.get("body")||"").trim().slice(0,2000);
 if(!title||!body) throw new Error("Title and message are required");
 const {error}=await supabase.from("announcements").insert({title,body,active:true});
 if(error) throw new Error(error.message);
 revalidatePath("/admin/settings");revalidatePath("/");
}
export async function updateAnnouncement(form:FormData){
 const {supabase}=await requireAdmin();
 const id=String(form.get("id")||"");
 const active=form.get("active")==="on";
 if(!id) throw new Error("Missing announcement id");
 const {error}=await supabase.from("announcements").update({active}).eq("id",id);
 if(error) throw new Error(error.message);
 revalidatePath("/admin/settings");revalidatePath("/");
}
export async function deleteAnnouncement(form:FormData){
 const {supabase}=await requireAdmin();
 const id=String(form.get("id")||"");
 if(!id) throw new Error("Missing announcement id");
 const {error}=await supabase.from("announcements").delete().eq("id",id);
 if(error) throw new Error(error.message);
 revalidatePath("/admin/settings");revalidatePath("/");
}
