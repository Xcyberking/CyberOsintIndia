import Link from "next/link";
import {requireAdmin} from "@/lib/auth";
export default async function Admin(){
 const {supabase}=await requireAdmin();
 const [{count:users},{count:searches},{count:tools},{count:announcements},{count:referrals},{data:recentUsers}]=await Promise.all([
  supabase.from("profiles").select("*",{count:"exact",head:true}),
  supabase.from("search_history").select("*",{count:"exact",head:true}),
  supabase.from("tools").select("*",{count:"exact",head:true}),
  supabase.from("announcements").select("*",{count:"exact",head:true}),
  supabase.from("referral_claims").select("*",{count:"exact",head:true}),
  supabase.from("profiles").select("id,email,display_name,role,credits,created_at").order("created_at",{ascending:false}).limit(6)
 ]);
 const sections=[
  ["/admin/users","User management","Roles, account list and credit adjustments"],
  ["/admin/tools","Tool management","Add, edit, enable, disable and delete tool entries"],
  ["/admin/activity","Activity & transactions","Search history and credit ledger"],
  ["/admin/referrals","Referral management","Successful referrals and reward tracking"],
  ["/admin/settings","Site settings & announcements","Contact links, announcements and provider status"],
  ["/admin/health","API & system health","Service configuration and health checks"],
  ["/announcements","Public announcements","Preview published site updates"],
  ["/contact","Contact page","Preview public contact information"]
 ];
 return <main className="panel-page"><Link href="/dashboard">← Dashboard</Link><span className="eyebrow">MASTER CONTROL CENTER</span><h1>Admin <em>Dashboard</em></h1><p>Manage the CyberX OSINT catalogue, users, credits, referrals, announcements and system settings from dedicated control pages.</p>
 <div className="stats"><article><small>REGISTERED USERS</small><b>{users??0}</b></article><article><small>TOOL SEARCHES</small><b>{searches??0}</b></article><article><small>TOOL ENTRIES</small><b>{tools??0}</b></article><article><small>SUCCESSFUL REFERRALS</small><b>{referrals??0}</b></article><article><small>ANNOUNCEMENTS</small><b>{announcements??0}</b></article></div>
 <h2>Admin controls</h2><div className="admin-control-grid">{sections.map(([href,title,desc])=><Link className="admin-control-card" href={href} key={href}><span>{title}</span><small>{desc}</small><b>Open controls →</b></Link>)}</div>
 <h2>Recently registered users</h2><div className="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Credits</th><th>Joined</th></tr></thead><tbody>{recentUsers?.map(p=><tr key={p.id}><td>{p.display_name||"Unnamed"}<br/><small>{p.email}</small></td><td>{p.role}</td><td>{p.credits}</td><td>{new Date(p.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div>
 <p className="muted">Admin access is checked on the server and again in database policies. Secret API keys are never shown or stored in public settings. Account deletion and suspension are not enabled.</p>
 </main>;
}