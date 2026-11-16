import Link from "next/link";
import {requireUser} from "@/lib/auth";
import {saveProfile,changePasswordFromProfile} from "@/app/auth/actions";
import ReferralShare from "@/components/ReferralShare";

export default async function Profile({searchParams}:{searchParams:Promise<{error?:string;message?:string}>}){
 const q=await searchParams;
 const {supabase,user}=await requireUser();
 let referralNotice="";
 try{
  const {data:claim,error:claimError}=await supabase.rpc("claim_referral_reward");
  if(claimError) referralNotice="Referral reward could not be checked right now. Your profile is still available.";
  else if(claim?.success) referralNotice="Referral reward applied: you received 10 bonus credits.";
 }catch{referralNotice="Referral reward could not be checked right now. Your profile is still available.";}
 const {data:p,error}=await supabase.from("profiles").select("display_name,bio,role,credits,created_at,referral_code").eq("id",user.id).single();
 const siteUrl=(process.env.NEXT_PUBLIC_SITE_URL||"https://cyber-osint-india.vercel.app").replace(/\/$/,"");
 const referralLink=p?.referral_code?siteUrl+"/register?ref="+encodeURIComponent(p.referral_code):"";
 return <main className="panel-page">
  <Link href="/dashboard">← Dashboard</Link><span className="eyebrow">ACCOUNT SETTINGS</span><h1>Edit profile</h1>
  <p className="muted">Update your public display details, manage your password and invite friends.</p>
  {q.error&&<div className="error">{q.error}</div>}{q.message&&<div className="success">{q.message}</div>}
  {referralNotice&&<div className={referralNotice.startsWith("Referral reward applied")?"success":"error"}>{referralNotice}</div>}
  {error&&<div className="error">Could not load profile details. Please refresh and try again.</div>}
  <form action={saveProfile} className="auth-card" style={{marginTop:22}}>
   <h2 style={{margin:"0 0 4px"}}>Personal information</h2>
   <label>Display name<input name="display_name" required minLength={2} maxLength={60} defaultValue={p?.display_name||""} placeholder="Your display name"/></label>
   <label>Bio <small className="muted">Up to 160 characters</small><textarea name="bio" maxLength={160} rows={4} defaultValue={p?.bio||""} placeholder="A short introduction (optional)"/></label>
   <button className="primary" type="submit">Save profile</button>
  </form>
  {p?.referral_code&&<ReferralShare code={p.referral_code} link={referralLink}/>}
  <form action={changePasswordFromProfile} className="auth-card" style={{marginTop:18}}>
   <h2 style={{margin:"0 0 4px"}}>Change password</h2>
   <label>New password<input name="password" type="password" minLength={8} required autoComplete="new-password" placeholder="At least 8 characters"/></label>
   <button className="ghost" type="submit">Update password</button>
  </form>
  <section className="auth-card" style={{marginTop:18}}>
   <h2 style={{margin:"0 0 4px"}}>Account details</h2>
   <p><b>Email</b><br/>{user.email}</p><p><b>Account role</b><br/>{p?.role||"user"}</p>
   <p><b>Available credits</b><br/>{p?.credits??0}</p><p><b>Referral code</b><br/>{p?.referral_code||"—"}</p>
   <p><b>Member since</b><br/>{p?.created_at?new Date(p.created_at).toLocaleDateString():"—"}</p>
   <small className="muted">Email, role and credits are read-only here. Account permissions cannot be changed from profile settings.</small>
  </section>
 </main>;
}