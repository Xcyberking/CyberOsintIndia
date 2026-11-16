import Link from "next/link";
import {requireAdmin} from "@/lib/auth";
import {saveContactSettings,createAnnouncement,updateAnnouncement,deleteAnnouncement} from "./actions";
const providers=[["IP metadata","IPWHOIS_API_KEY","Optional; current public endpoint can work without a key"],["URL reputation","URL_REPUTATION_API_KEY","Optional provider integration; no verdict until configured"],["VirusTotal","VIRUSTOTAL_API_KEY","Optional; not yet queried by URL checker"],["Email verification","EMAIL_PROVIDER_API_KEY","Optional; syntax validation remains active"]];
export default async function AdminSettings(){
 const {supabase}=await requireAdmin();
 const [{data:contact},{data:announcements}]=await Promise.all([
  supabase.from("site_settings").select("value").eq("key","contact").maybeSingle(),
  supabase.from("announcements").select("*").order("created_at",{ascending:false}).limit(30)
 ]);
 const c=contact?.value||{};
 return <main className="panel-page"><Link href="/admin">← Admin panel</Link><span className="eyebrow">SITE CONFIGURATION</span><h1>Admin settings</h1>
 <h2>Provider environment status</h2><p>Only presence is shown. Add or rotate secrets in Vercel → Project → Settings → Environment Variables. Secret values are never stored in Supabase or exposed to the browser.</p>
 <div className="table-wrap"><table><thead><tr><th>Provider</th><th>Vercel variable</th><th>Status</th><th>Purpose</th></tr></thead><tbody>{providers.map(([name,key,purpose])=><tr key={key}><td>{name}</td><td>{key}</td><td>{process.env[key]?"Configured":"Not configured"}</td><td>{purpose}</td></tr>)}</tbody></table></div>
 <h2>Public contact settings</h2><form action={saveContactSettings} className="settings-form">{(["email","telegram","whatsapp","github","instagram","youtube"] as const).map(k=><label key={k}>{k.toUpperCase()}<input name={k} type={k==="email"?"email":"url"} defaultValue={c[k]||""} placeholder={k==="email"?"support@example.com":"https://…"}/></label>)}<button className="primary">Save contact links</button></form>
 <h2>Announcements</h2><form action={createAnnouncement} className="settings-form"><label>Title<input name="title" maxLength={100} required/></label><label>Message<textarea name="body" maxLength={2000} required rows={4}/></label><button className="primary">Publish announcement</button></form>
 <div className="table-wrap"><table><thead><tr><th>Announcement</th><th>Status</th><th>Actions</th></tr></thead><tbody>{announcements?.map(a=><tr key={a.id}><td><b>{a.title}</b><br/><small>{a.body}</small></td><td>{a.active?"Active":"Hidden"}</td><td><form action={updateAnnouncement} className="inline-form"><input type="hidden" name="id" value={a.id}/><label className="check"><input type="checkbox" name="active" defaultChecked={a.active}/> Visible</label><button className="primary">Save</button></form><form action={deleteAnnouncement}><input type="hidden" name="id" value={a.id}/><button className="ghost">Delete</button></form></td></tr>)}</tbody></table></div>
 <p className="muted">Payment processing is intentionally not activated in this release. Credit packages remain informational until a legitimate payment provider and verified merchant account are configured.</p>
 </main>;
}
