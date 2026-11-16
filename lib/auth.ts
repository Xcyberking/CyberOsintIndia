import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
export async function requireUser(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");return {supabase,user};}
export async function requireAdmin(){const ctx=await requireUser();const {data:profile}=await ctx.supabase.from("profiles").select("role").eq("id",ctx.user.id).single();if(profile?.role!=="admin")redirect("/dashboard");return ctx;}