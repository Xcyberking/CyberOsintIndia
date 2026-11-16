"use server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
export async function signIn(form:FormData){const supabase=await createClient();const email=String(form.get("email")||"").trim();const password=String(form.get("password")||"");const {error}=await supabase.auth.signInWithPassword({email,password});if(error)redirect("/login?error="+encodeURIComponent(error.message));redirect("/dashboard");}
export async function signUp(form:FormData){const supabase=await createClient();const email=String(form.get("email")||"").trim();const password=String(form.get("password")||"");const name=String(form.get("name")||"").trim();if(password.length<8)redirect("/register?error=Password%20must%20be%20at%20least%208%20characters");const {error}=await supabase.auth.signUp({email,password,options:{data:{display_name:name,referral_code:String(form.get("referral_code")||"").trim().toUpperCase()},emailRedirectTo:process.env.NEXT_PUBLIC_SITE_URL?process.env.NEXT_PUBLIC_SITE_URL+"/auth/callback":undefined}});if(error)redirect("/register?error="+encodeURIComponent(error.message));redirect("/login?message=Check%20your%20email%20to%20confirm%20your%20account");}
export async function signInWithGoogle(){const supabase=await createClient();const {data,error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:(process.env.NEXT_PUBLIC_SITE_URL||"http://localhost:3000")+"/auth/callback"}});if(error)redirect("/login?error="+encodeURIComponent(error.message));if(data.url)redirect(data.url);}
export async function sendPasswordReset(form:FormData){const supabase=await createClient();const email=String(form.get("email")||"").trim();const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:(process.env.NEXT_PUBLIC_SITE_URL||"http://localhost:3000")+"/auth/callback?next=/reset-password"});if(error)redirect("/forgot-password?error="+encodeURIComponent(error.message));redirect("/forgot-password?message=Password%20reset%20email%20sent");}
export async function updatePassword(form:FormData){const supabase=await createClient();const password=String(form.get("password")||"");if(password.length<8)redirect("/reset-password?error=Password%20must%20be%20at%20least%208%20characters");const {error}=await supabase.auth.updateUser({password});if(error)redirect("/reset-password?error="+encodeURIComponent(error.message));redirect("/login?message=Password%20updated");}
export async function saveProfile(form:FormData){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user) redirect("/login");
 const displayName=String(form.get("display_name")||"").trim();
 const bio=String(form.get("bio")||"").trim();
 if(displayName.length<2||displayName.length>60) redirect("/profile?error=Display%20name%20must%20be%202%E2%80%9360%20characters");
 if(bio.length>160) redirect("/profile?error=Bio%20must%20be%20160%20characters%20or%20less");
 const {error}=await supabase.from("profiles").update({display_name:displayName,bio}).eq("id",user.id).select("id").maybeSingle();
 if(error) redirect("/profile?error="+encodeURIComponent(error.message));
 redirect("/profile?message=Profile%20updated%20successfully");
}
export async function changePasswordFromProfile(form:FormData){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user) redirect("/login");
 const password=String(form.get("password")||"");
 if(password.length<8) redirect("/profile?error=Password%20must%20be%20at%20least%208%20characters");
 const {error}=await supabase.auth.updateUser({password});
 if(error) redirect("/profile?error="+encodeURIComponent(error.message));
 redirect("/profile?message=Password%20updated%20successfully");
}
export async function signOut(){const supabase=await createClient();await supabase.auth.signOut();redirect("/");}
