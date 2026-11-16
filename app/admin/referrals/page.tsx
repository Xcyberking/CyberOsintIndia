import Link from "next/link";
import {requireAdmin} from "@/lib/auth";
export default async function AdminReferrals(){
 const {supabase}=await requireAdmin();
 const {data:claims}=await supabase.from("referral_claims").select("id,referrer_id,referred_id,reward,created_at").order("created_at",{ascending:false}).limit(200);
 const ids=[...new Set((claims||[]).flatMap(x=>[x.referrer_id,x.referred_id]))];
 const {data:people}=ids.length?await supabase.from("profiles").select("id,email,display_name").in("id",ids):{data:[]};
 const map=new Map((people||[]).map(p=>[p.id,p.email||p.display_name||p.id]));
 return <main className="panel-page"><Link href="/admin">← Control center</Link><span className="eyebrow">INVITE PROGRAM</span><h1>Referral management</h1><p>Successful verified referrals and rewards. Current reward policy: invited user +10 credits, referrer +5 credits.</p><div className="stats"><article><small>SUCCESSFUL REFERRALS SHOWN</small><b>{claims?.length??0}</b></article><article><small>REFERRER CREDITS AWARDED</small><b>{(claims||[]).reduce((n,x)=>n+x.reward,0)}</b></article></div><div className="table-wrap"><table><thead><tr><th>Referrer</th><th>New user</th><th>Referrer reward</th><th>Date</th></tr></thead><tbody>{claims?.map(x=><tr key={x.id}><td>{map.get(x.referrer_id)||x.referrer_id}</td><td>{map.get(x.referred_id)||x.referred_id}</td><td>+{x.reward}</td><td>{new Date(x.created_at).toLocaleString()}</td></tr>)}{!claims?.length&&<tr><td colSpan={4}>No successful referrals yet.</td></tr>}</tbody></table></div></main>;
}