import Link from "next/link";
import {requireUser} from "@/lib/auth";
import {signOut} from "@/app/auth/actions";

export default async function Dashboard(){
 const {supabase,user}=await requireUser();
 // Referral rewards are processed automatically on the first authenticated visit after email confirmation.
 try { await supabase.rpc("claim_referral_reward"); } catch { /* referral processing must not block dashboard access */ }
 const [{data:profile},{data:history,count}]=await Promise.all([
  supabase.from("profiles").select("*").eq("id",user.id).single(),
  supabase.from("search_history").select("*",{count:"exact"}).eq("user_id",user.id).order("created_at",{ascending:false}).limit(8)
 ]);
 return <main className="panel-page">
  <header className="panel-head"><Link href="/">CyberX <em>OSINT</em></Link><form action={signOut}><button className="ghost">Logout</button></form></header>
  <span className="eyebrow">YOUR WORKSPACE</span><h1>Welcome, {profile?.display_name||user.email}</h1>
  <div className="stats"><article><small>AVAILABLE CREDITS</small><b>{profile?.credits??0}</b></article><article><small>TOTAL SEARCHES</small><b>{count??0}</b></article><article><small>ACCOUNT ROLE</small><b>{profile?.role??"user"}</b></article></div>
  <div className="panel-links"><Link href="/tools">Explore tools →</Link><Link href="/credits">Credit history →</Link><Link href="/profile">Profile settings →</Link><Link href="/referrals">Referral program →</Link>{profile?.role==="admin"&&<><Link href="/admin">Admin panel →</Link><Link href="/admin/health">API health →</Link></>}</div>
  <h2>Recent activity</h2><div className="table-wrap"><table><thead><tr><th>Tool</th><th>Input summary</th><th>Status</th><th>Date</th></tr></thead><tbody>
   {history?.map(x=><tr key={x.id}><td>{x.tool_slug}</td><td>{x.input_summary}</td><td>{x.status}</td><td>{new Date(x.created_at).toLocaleString()}</td></tr>)}
   {!history?.length&&<tr><td colSpan={4}>No searches yet.</td></tr>}
  </tbody></table></div>
 </main>;
}