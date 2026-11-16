import Link from "next/link";
import {requireUser} from "@/lib/auth";

export default async function Referrals(){
 const {supabase,user}=await requireUser();
 // Claim automatically once the invited account has verified its email and signed in.
 const {data:claimResult}=await supabase.rpc("claim_referral_reward");
 const [{data:p},{data:items}]=await Promise.all([
  supabase.from("profiles").select("referral_code,credits").eq("id",user.id).single(),
  supabase.from("referral_claims").select("created_at,reward").eq("referrer_id",user.id).order("created_at",{ascending:false})
 ]);
 const siteUrl=(process.env.NEXT_PUBLIC_SITE_URL||"https://cyber-osint-india.vercel.app").replace(/\/$/,"");
 const referralLink=p?.referral_code?siteUrl+"/register?ref="+encodeURIComponent(p.referral_code):"";
 return <main className="panel-page">
  <Link href="/dashboard">← Dashboard</Link><span className="eyebrow">INVITE & EARN</span><h1>Referral program</h1>
  <p>Invite a friend using your personal link. When they create an account, verify their email and sign in, rewards are added automatically.</p>
  {claimResult?.success&&<div className="success">Referral bonus applied: you received 10 credits.</div>}
  <div className="auth-card">
   <b>Your referral code</b><h2>{p?.referral_code||"Generating…"}</h2>
   <p>Share this referral link with a friend:</p>
   <label>Referral link<input readOnly value={referralLink}/></label>
   <p><b>Friend who joins:</b> +10 credits</p><p><b>You:</b> +5 credits for each successful referral</p>
   <small className="muted">The bonus is credited once per new account, after email verification and first sign-in. Self-referrals and repeat claims are rejected.</small>
  </div>
  <h2>Successful referrals</h2>
  <div className="table-wrap"><table><thead><tr><th>Your reward</th><th>Date</th></tr></thead><tbody>
   {items?.map((x,i)=><tr key={i}><td>+{x.reward} credits</td><td>{new Date(x.created_at).toLocaleString()}</td></tr>)}
   {!items?.length&&<tr><td colSpan={2}>No successful referrals yet.</td></tr>}
  </tbody></table></div>
 </main>;
}