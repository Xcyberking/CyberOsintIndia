"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient, type User as AuthUser } from "@supabase/supabase-js";
import {
  Activity, ArrowRight, Bell, BookOpen, CheckCircle2, ChevronDown, Code2, Coins, CreditCard, Database, FileClock,
  Gem, LayoutDashboard, LockKeyhole, LogOut, Megaphone, Menu, Palette, Pencil, Plus, RefreshCw, Search, Settings,
  Shield, ShieldCheck, Ticket, Trash2, Users, Wrench, X, Zap, Crown, Ban, Server, Link2, Github, Chrome, Send,
  FileText, Gauge, BarChart3
} from "lucide-react";
import Logo from "../Logo";
import "./admin.css";
import "./admin-extra.css";

type Row = Record<string, unknown>;
type SectionKey = "dashboard"|"users"|"banned"|"tools"|"plans"|"payments"|"credits"|"referrals"|"settings"|"appearance"|"announcements"|"api"|"backup"|"logs"|"developer"|"support"|"analytics"|"system"|"about";
type Section = { key: SectionKey; label: string; table?: string; description: string; icon: typeof Shield; };
const sections: Section[] = [
  {key:"dashboard",label:"Dashboard",description:"",icon:LayoutDashboard},
  {key:"users",label:"User Management",table:"profiles",description:"Review accounts, roles, status and credit balances",icon:Users},
  {key:"banned",label:"Banned Users",table:"profiles",description:"Review suspended and banned accounts",icon:Ban},
  {key:"tools",label:"Tool Management",table:"tools",description:"Enable, disable and organize public-source tools",icon:Wrench},
  {key:"plans",label:"Premium Management",table:"premium_plans",description:"Manage plan names, prices, credits and duration",icon:Crown},
  {key:"payments",label:"Payment & Credits",table:"payment_records",description:"Review payment records and statuses",icon:CreditCard},
  {key:"credits",label:"Credits",table:"credit_transactions",description:"Audit credit grants and deductions",icon:Coins},
  {key:"referrals",label:"Referral System",table:"referral_claims",description:"Review referral qualification and rewards",icon:Users},
  {key:"settings",label:"Site Settings",table:"site_settings",description:"Store public site configuration",icon:Settings},
  {key:"appearance",label:"Appearance",table:"site_settings",description:"Manage theme and branding settings",icon:Palette},
  {key:"announcements",label:"Announcement",table:"announcements",description:"Publish service notices and updates",icon:Megaphone},
  {key:"api",label:"API Management",table:"api_integrations",description:"Manage public API endpoint configuration",icon:Link2},
  {key:"backup",label:"Backup & Restore",description:"Database backup guidance and restore checklist",icon:Database},
  {key:"logs",label:"Logs & Activity",table:"admin_audit_logs",description:"Review administrative actions",icon:FileClock},
  {key:"developer",label:"Developer Hub",table:"developer_resources",description:"Manage documentation and developer resources",icon:Code2},
  {key:"support",label:"Support Center",table:"support_tickets",description:"Review user support requests",icon:Ticket},
  {key:"analytics",label:"Site Analytics",description:"Live counts from your configured database tables",icon:BarChart3},
  {key:"system",label:"System Information",description:"Runtime and service configuration status",icon:Server},
  {key:"about",label:"About CyberX OSINT",description:"Project details and safety boundaries",icon:ShieldCheck}
];
const navKeys: SectionKey[] = ["dashboard","users","tools","plans","payments","referrals","settings","appearance","announcements","logs","backup","api","developer","support","analytics","system","about"];
const tableByKey: Partial<Record<SectionKey,string>> = {
  users:"profiles",banned:"profiles",tools:"tools",plans:"premium_plans",payments:"payment_records",
  credits:"credit_transactions",referrals:"referral_claims",settings:"site_settings",appearance:"site_settings",
  announcements:"announcements",api:"api_integrations",logs:"admin_audit_logs",developer:"developer_resources",support:"support_tickets"
};
const envUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
const envKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase=envUrl&&envKey?createClient(envUrl,envKey):null;

function valueText(value: unknown): string {
  if (value===null||value===undefined) return "—";
  if (typeof value==="object") return JSON.stringify(value);
  return String(value);
}
function dateText(value: unknown): string {
  if (!value) return "—";
  const date=new Date(String(value));
  return Number.isNaN(date.getTime())?String(value):date.toLocaleString();
}
const plain=(v:unknown)=>typeof v==="string"?v:v===null||v===undefined?"":String(v);
const sum=(a:number[])=>a.reduce((s,n)=>s+n,0);

type Dash={recent:Row[];plans:Row[];toolRows:Row[];users30:number[];searches30:number[];revenue:number;start:number};

function Chart({a,b,start}:{a:number[];b:number[];start:number}){
  const [hv,setHv]=useState<number|null>(null);
  const W=640,H=230,L=34,R=10,T=14,B=28;
  const max=Math.max(1,...a,...b);
  const step=(W-L-R)/29;
  const x=(i:number)=>L+i*step;
  const y=(v:number)=>H-B-(v/max)*(H-T-B);
  const line=(s:number[])=>s.map((v,i)=>`${x(i)},${y(v)}`).join(" ");
  const area=(s:number[])=>`${x(0)},${H-B} ${line(s)} ${x(29)},${H-B}`;
  const lbl=(i:number)=>new Date(start+i*864e5).toLocaleDateString("en-US",{month:"short",day:"numeric"});
  const tx=hv===null?0:Math.min(Math.max(x(hv)-62,L),W-R-124);
  return <svg className="admin-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="New users and searches, last 30 days" onMouseLeave={()=>setHv(null)}>
    <defs><linearGradient id="cxArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#27c8ff" stopOpacity=".38"/><stop offset="1" stopColor="#27c8ff" stopOpacity="0"/></linearGradient></defs>
    {[0,.25,.5,.75,1].map(t=>{const yy=H-B-t*(H-T-B);return <g key={t}><line x1={L} x2={W-R} y1={yy} y2={yy} stroke="#17407f" strokeOpacity=".6"/><text x={2} y={yy+4} fontSize="10" fill="#8fa6cc">{Math.round(max*t)}</text></g>;})}
    {Array.from({length:10},(_,k)=>k*3).map(i=><text key={i} x={x(i)} y={H-8} fontSize="10" fill="#8fa6cc" textAnchor="middle">{lbl(i)}</text>)}
    <polygon points={area(a)} fill="url(#cxArea)"/>
    <polygon points={area(b)} fill="#ffffff" fillOpacity=".06"/>
    <polyline points={line(a)} fill="none" stroke="#27c8ff" strokeWidth="2.5" strokeLinejoin="round"/>
    <polyline points={line(b)} fill="none" stroke="#ffffff" strokeOpacity=".85" strokeWidth="2" strokeLinejoin="round"/>
    {hv!==null&&<g pointerEvents="none">
      <line x1={x(hv)} x2={x(hv)} y1={T} y2={H-B} stroke="#fff" strokeOpacity=".5" strokeDasharray="3 3"/>
      <circle cx={x(hv)} cy={y(a[hv])} r="5" fill="#27c8ff" stroke="#fff" strokeWidth="2"/>
      <circle cx={x(hv)} cy={y(b[hv])} r="4" fill="#fff"/>
      <rect x={tx} y={T} width="124" height="52" rx="8" fill="#0a1a40" stroke="#27c8ff" strokeOpacity=".6"/>
      <text x={tx+10} y={T+16} fontSize="11" fontWeight="700" fill="#fff">{lbl(hv)}</text>
      <text x={tx+10} y={T+31} fontSize="11" fill="#27c8ff">New users: {a[hv]}</text>
      <text x={tx+10} y={T+45} fontSize="11" fill="#fff">Searches: {b[hv]}</text>
    </g>}
    {a.map((_,i)=><rect key={i} x={x(i)-step/2} y={T} width={step} height={H-T-B} fill="transparent" onMouseEnter={()=>setHv(i)} onTouchStart={()=>setHv(i)}/>)}
  </svg>;
}

export default function AdminPage() {
  const [section,setSection]=useState<SectionKey>("dashboard");
  const [authUser,setAuthUser]=useState<AuthUser|null>(null);
  const [adminName,setAdminName]=useState("");
  const [isAdmin,setIsAdmin]=useState(false);
  const [checking,setChecking]=useState(true);
  const [collapsed,setCollapsed]=useState(false);
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [message,setMessage]=useState("");
  const [rows,setRows]=useState<Row[]>([]);
  const [loading,setLoading]=useState(false);
  const [search,setSearch]=useState("");
  const [form,setForm]=useState<Record<string,string>>({});
  const [saving,setSaving]=useState(false);
  const [counts,setCounts]=useState<Record<string,number>>({});
  const [openTickets,setOpenTickets]=useState(0);
  const [dash,setDash]=useState<Dash|null>(null);
  const [siteForm,setSiteForm]=useState<Record<string,string>>({site_name:"",site_url:"",default_credits:""});
  const [userEdits,setUserEdits]=useState<Record<string,{role:string;status:string;delta:string;reason:string}>>({});

  const verify=useCallback(async()=>{
    if(!supabase){setChecking(false);return;}
    setChecking(true);
    const {data:{user},error:authError}=await supabase.auth.getUser();
    if(authError){setAuthUser(null);setIsAdmin(false);setMessage(authError.message);setChecking(false);return;}
    setAuthUser(user);
    if(user){
      const {data,error}=await supabase.from("profiles").select("role,status,display_name").eq("id",user.id).maybeSingle();
      if(error){
        setIsAdmin(false);
        setMessage("Signed in, but admin role verification failed: "+error.message);
      } else {
        setIsAdmin(data?.role==="admin" && data?.status==="active");
        setAdminName(data?.display_name||user.email?.split("@")[0]||"Admin");
        if(data?.role!=="admin" || data?.status!=="active") setMessage("This account is signed in but is not an active administrator.");
        else setMessage("");
      }
    } else setIsAdmin(false);
    setChecking(false);
  },[]);
  useEffect(()=>{
    void verify();
    if(!supabase)return;
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      if(!session){
        setAuthUser(null);setIsAdmin(false);setChecking(false);
        return;
      }
      window.setTimeout(()=>{void verify();},0);
    });
    return ()=>subscription.unsubscribe();
  },[verify]);

  const active=sections.find(s=>s.key===section)!;
  const loadRows=useCallback(async()=>{
    if(!supabase||!isAdmin)return;
    const table=tableByKey[section];
    if(!table){setRows([]);return;}
    setLoading(true);
    let request=supabase.from(table).select("*").order(table==="site_settings"?"updated_at":"created_at",{ascending:false}).limit(100);
    if(section==="banned") request=request.in("status",["banned","suspended"]);
    const {data,error}=await request;
    if(error)setMessage(error.message);
    else setRows((data||[]) as Row[]);
    setLoading(false);
  },[section,isAdmin]);
  useEffect(()=>{void loadRows();},[loadRows]);

  const loadCounts=useCallback(async()=>{
    if(!supabase||!isAdmin)return;
    const tables=["profiles","tools","premium_plans","payment_records","support_tickets","referral_claims","search_history"];
    const results=await Promise.all(tables.map(async table=>{
      const {count}=await supabase.from(table).select("*",{count:"exact",head:true});
      return [table,count||0] as const;
    }));
    setCounts(Object.fromEntries(results));
    const {count:open}=await supabase.from("support_tickets").select("*",{count:"exact",head:true}).eq("status","open");
    setOpenTickets(open||0);
  },[isAdmin]);
  useEffect(()=>{void loadCounts();},[loadCounts]);

  const loadDash=useCallback(async()=>{
    if(!supabase||!isAdmin)return;
    const since=new Date(Date.now()-29*864e5);since.setHours(0,0,0,0);
    const iso=since.toISOString();
    const [recent,u30,s30,pl,tl,pay,site]=await Promise.all([
      supabase.from("profiles").select("*").order("created_at",{ascending:false}).limit(5),
      supabase.from("profiles").select("created_at").gte("created_at",iso).limit(5000),
      supabase.from("search_history").select("created_at").gte("created_at",iso).limit(5000),
      supabase.from("premium_plans").select("*").order("price_inr").limit(4),
      supabase.from("tools").select("*").order("created_at",{ascending:false}).limit(6),
      supabase.from("payment_records").select("amount_inr").eq("status","success").limit(5000),
      supabase.from("site_settings").select("key,value").in("key",["site_name","site_url","default_credits"])
    ]);
    const bucket=(data:Row[]|null)=>{const a:number[]=Array(30).fill(0);(data||[]).forEach(r=>{const i=Math.floor((new Date(String(r.created_at)).getTime()-since.getTime())/864e5);if(i>=0&&i<30)a[i]++;});return a;};
    const siteMap:Record<string,string>={site_name:"",site_url:"",default_credits:""};
    ((site.data||[]) as Row[]).forEach(r=>{siteMap[String(r.key)]=plain(r.value);});
    setSiteForm(siteMap);
    setDash({
      recent:(recent.data||[]) as Row[],plans:(pl.data||[]) as Row[],toolRows:(tl.data||[]) as Row[],
      users30:bucket(u30.data as Row[]|null),searches30:bucket(s30.data as Row[]|null),
      revenue:((pay.data||[]) as Row[]).reduce((s,r)=>s+Number(r.amount_inr||0),0),start:since.getTime()
    });
  },[isAdmin]);
  useEffect(()=>{if(section==="dashboard")void loadDash();},[section,loadDash]);

  async function login(){
    if(!supabase){setMessage("Supabase is not configured. Add the two NEXT_PUBLIC Supabase variables.");return;}
    setMessage("");
    const {error}=await supabase.auth.signInWithPassword({email,password});
    if(error)setMessage(error.message);
    else await verify();
  }
  async function oauthLogin(provider:"google"|"github"){
    if(!supabase){setMessage("Supabase is not configured.");return;}
    setMessage("");
    const redirectTo=window.location.origin+"/auth/callback?next=%2Fadmin";
    const {error}=await supabase.auth.signInWithOAuth({provider,options:{redirectTo,scopes:provider==="github"?"read:user user:email":"openid email profile"}});
    if(error)setMessage(error.message);
  }
  async function logout(){if(supabase)await supabase.auth.signOut();setAuthUser(null);setIsAdmin(false);setMessage("");}

  async function saveRecord(){
    if(!supabase||!active.table)return;
    setSaving(true);setMessage("");
    let payload:Row={};
    if(section==="tools") payload={slug:(form.name||"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""),name:form.name||"",description:form.description||"",category:form.category||"Research",credit_cost:1,enabled:form.enabled!=="false"};
    else if(section==="plans") payload={name:form.name||"",description:form.description||"",price_inr:Number(form.price||0),credits:Number(form.credits||0),duration_days:Number(form.duration||30),is_active:true};
    else if(section==="announcements") payload={title:form.name||"",body:form.description||"",active:form.enabled==="true",is_published:form.enabled==="true",created_by:authUser?.id};
    else if(section==="api") payload={name:form.name||"",base_url:form.url||"",description:form.description||"",is_enabled:form.enabled==="true"};
    else if(section==="developer") payload={title:form.name||"",resource_type:form.type||"documentation",url:form.url||"",description:form.description||"",is_published:true};
    else if(section==="settings"||section==="appearance"){
      let parsed:unknown;
      try{parsed=JSON.parse(form.value||"{}");}catch{setMessage("Value must be valid JSON.");setSaving(false);return;}
      payload={key:form.name||"",value:parsed,updated_by:authUser?.id,updated_at:new Date().toISOString()};
    } else {setSaving(false);return;}
    const {error}=await (section==="settings"||section==="appearance" ? supabase.from(active.table).upsert(payload) : supabase.from(active.table).insert(payload));
    if(error)setMessage(error.message);
    else {setForm({});setMessage("Saved successfully.");await loadRows();await loadCounts();}
    setSaving(false);
  }
  async function saveSite(){
    if(!supabase)return;
    const now=new Date().toISOString();
    const payload=[
      {key:"site_name",value:siteForm.site_name||"",updated_by:authUser?.id,updated_at:now},
      {key:"site_url",value:siteForm.site_url||"",updated_by:authUser?.id,updated_at:now},
      {key:"default_credits",value:Number(siteForm.default_credits||0),updated_by:authUser?.id,updated_at:now}
    ];
    const {error}=await supabase.from("site_settings").upsert(payload);
    setMessage(error?error.message:"Site settings saved.");
  }
  async function deleteRow(table:string,id:string,label:string){
    if(!supabase)return;
    if(!window.confirm("Delete "+label+"? This cannot be undone."))return;
    const {error}=await supabase.from(table).delete().eq("id",id);
    setMessage(error?error.message:"Deleted.");
    if(!error){await loadRows();await loadCounts();await loadDash();}
  }

  async function updateUser(id:string){
    if(!supabase)return;
    const edit=userEdits[id]||{role:"user",status:"active",delta:"0",reason:"Admin adjustment"};
    const {error}=await supabase.rpc("admin_update_user",{target_user_id:id,new_role:edit.role,new_status:edit.status,credit_delta:Number(edit.delta||0),credit_reason:edit.reason||"Admin adjustment"});
    if(error)setMessage(error.message);
    else {setMessage("User account updated.");await loadRows();await loadCounts();}
  }
  async function updateStatus(id:string,status:string){
    if(!supabase)return;
    const {error}=await supabase.from("support_tickets").update({status,updated_at:new Date().toISOString()}).eq("id",id);
    setMessage(error?error.message:"Ticket updated.");if(!error){await loadRows();await loadCounts();}
  }
  async function publishAnnouncement(id:string,published:boolean){
    if(!supabase)return;
    const {error}=await supabase.from("announcements").update({is_published:published,active:published}).eq("id",id);
    setMessage(error?error.message:"Announcement updated.");if(!error)await loadRows();
  }
  async function toggleTool(id:string,enabled:boolean){
    if(!supabase)return;
    const {error}=await supabase.from("tools").update({enabled}).eq("id",id);
    setMessage(error?error.message:"Tool status updated.");
    if(!error){await loadRows();await loadDash();}
  }
  async function updateRow(table:string,id:string,patch:Row,success:string){
    if(!supabase)return;
    const {error}=await supabase.from(table).update(patch).eq("id",id);
    setMessage(error?error.message:success);if(!error){await loadRows();await loadDash();}
  }

  const filtered=useMemo(()=>rows.filter(row=>JSON.stringify(row).toLowerCase().includes(search.toLowerCase())),[rows,search]);
  const addable=["plans","announcements","api","developer","settings","appearance"].includes(section);

  if(checking)return <div className="admin-loading"><div className="admin-spinner"/>Checking admin access…</div>;
  if(!supabase)return <div className="admin-auth"><div className="admin-auth-card"><Logo size={70}/><h1>Cyber<span>X</span> OSINT</h1><p>Admin panel configuration required</p><div className="admin-warning">Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in your hosting environment, then redeploy.</div><a href="https://github.com/Xcyberking/CyberOsintIndia" target="_blank" rel="noreferrer">Open project repository <ArrowRight size={15}/></a></div></div>;
  if(!authUser||!isAdmin)return <div className="admin-auth"><div className="admin-auth-card"><Logo size={70}/><h1>Cyber<span>X</span> OSINT</h1><p>{authUser?"This account does not have active admin access.":"Secure administrator sign in"}</p>{!authUser&&<><label>Email address</label><input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="admin@example.com"/><label>Password</label><input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Your password"/><button className="admin-primary" onClick={login}><LockKeyhole size={16}/> Admin Login</button><div className="admin-oauth-divider"><span>OR CONTINUE WITH</span></div><div className="admin-oauth-grid"><button type="button" onClick={()=>void oauthLogin("google")}><Chrome size={16}/> Google</button><button type="button" onClick={()=>void oauthLogin("github")}><Github size={16}/> GitHub</button></div></>}{message&&<div className="admin-message">{message}</div>}{authUser&&!isAdmin&&<button className="admin-primary" onClick={()=>void logout()}><LogOut size={16}/> Sign out / switch account</button>}<div className="admin-auth-note">Only an account whose database profile has role=admin and status=active can enter this panel.</div></div></div>;

  const renderRows=()=>{
    if(loading)return <div className="admin-empty"><div className="admin-spinner"/>Loading records…</div>;
    if(!filtered.length)return <div className="admin-empty">No records found. Apply the database setup SQL and add your first records.</div>;
    const ue=(id:string,row:Row)=>userEdits[id]||{role:valueText(row.role),status:valueText(row.status),delta:"0",reason:"Admin adjustment"};
    if(section==="users"||section==="banned")return <div className="admin-table-wrap"><table><thead><tr><th>User ID</th><th>Username</th><th>Role</th><th>Status</th><th>Credits</th><th>Admin actions</th></tr></thead><tbody>{filtered.map(row=>{const id=String(row.id);return <tr key={id}><td className="mono">{id.slice(0,8)}…</td><td>{valueText(row.display_name||row.username||"User")}<small>{valueText(row.username)}</small></td><td><select value={ue(id,row).role} onChange={e=>setUserEdits(v=>({...v,[id]:{...ue(id,row),role:e.target.value}}))}><option value="user">User</option><option value="moderator">Moderator</option><option value="admin">Admin</option></select></td><td><select value={ue(id,row).status} onChange={e=>setUserEdits(v=>({...v,[id]:{...ue(id,row),status:e.target.value}}))}><option value="active">Active</option><option value="suspended">Suspended</option><option value="banned">Banned</option></select></td><td>{valueText(row.credits)}</td><td><div className="admin-inline"><input aria-label="Credit adjustment" placeholder="+/- credits" value={ue(id,row).delta} onChange={e=>setUserEdits(v=>({...v,[id]:{...ue(id,row),delta:e.target.value}}))}/><button className="admin-small" onClick={()=>updateUser(id)}>Save</button></div></td></tr>;})}</tbody></table></div>;
    if(section==="tools")return <div className="admin-records">{filtered.map(row=><div className="admin-record" key={String(row.id)}><div className="admin-record-icon"><Wrench size={18}/></div><div className="admin-record-main"><strong>{valueText(row.name)}</strong><small>{valueText(row.description)} · {valueText(row.category)}</small></div><label className="admin-switch"><input type="checkbox" checked={Boolean(row.enabled)} onChange={e=>toggleTool(String(row.id),e.target.checked)}/><span/></label><button className="admin-ibtn red" title="Delete" onClick={()=>deleteRow("tools",String(row.id),valueText(row.name))}><Trash2 size={15}/></button></div>)}</div>;
    if(section==="announcements")return <div className="admin-records">{filtered.map(row=><div className="admin-record" key={String(row.id)}><div className="admin-record-icon"><Megaphone size={18}/></div><div className="admin-record-main"><strong>{valueText(row.title)}</strong><small>{valueText(row.body)}</small></div><button className="admin-small" onClick={()=>publishAnnouncement(String(row.id),!Boolean(row.is_published))}>{row.is_published?"Unpublish":"Publish"}</button><button className="admin-ibtn red" title="Delete" onClick={()=>deleteRow("announcements",String(row.id),valueText(row.title))}><Trash2 size={15}/></button></div>)}</div>;
    if(section==="plans")return <div className="admin-records">{filtered.map(row=><div className="admin-record" key={String(row.id)}><div className="admin-record-icon"><Crown size={18}/></div><div className="admin-record-main"><strong>{valueText(row.name)} · ₹{valueText(row.price_inr)}</strong><small>{valueText(row.credits)} credits · {valueText(row.duration_days)} days · {valueText(row.description)}</small></div><label className="admin-switch"><input type="checkbox" checked={Boolean(row.is_active)} onChange={e=>updateRow("premium_plans",String(row.id),{is_active:e.target.checked},"Plan status updated.")}/><span/></label><button className="admin-ibtn red" title="Delete" onClick={()=>deleteRow("premium_plans",String(row.id),valueText(row.name))}><Trash2 size={15}/></button></div>)}</div>;
    if(section==="payments")return <div className="admin-records">{filtered.map(row=><div className="admin-record" key={String(row.id)}><div className="admin-record-icon"><CreditCard size={18}/></div><div className="admin-record-main"><strong>₹{valueText(row.amount_inr)} · {valueText(row.provider)}</strong><small>{valueText(row.provider_reference)} · {dateText(row.created_at)}</small></div><select value={valueText(row.status)} onChange={e=>updateRow("payment_records",String(row.id),{status:e.target.value},"Payment record updated.")}><option value="pending">Pending</option><option value="success">Success</option><option value="failed">Failed</option><option value="refunded">Refunded</option></select></div>)}</div>;
    if(section==="referrals")return <div className="admin-records">{filtered.map(row=><div className="admin-record" key={String(row.id)}><div className="admin-record-icon"><Users size={18}/></div><div className="admin-record-main"><strong>{valueText(row.referrer_id)} → {valueText(row.referred_id)}</strong><small>Reward: {valueText(row.reward)} credits · {dateText(row.created_at)}</small></div><select value={valueText(row.status)} onChange={e=>updateRow("referral_claims",String(row.id),{status:e.target.value},"Referral status updated. Credit reward is not automatically issued by this status change.")}><option value="pending">Pending</option><option value="qualified">Qualified</option><option value="rejected">Rejected</option></select></div>)}</div>;
    if(section==="api")return <div className="admin-records">{filtered.map(row=><div className="admin-record" key={String(row.id)}><div className="admin-record-icon"><Link2 size={18}/></div><div className="admin-record-main"><strong>{valueText(row.name)}</strong><small>{valueText(row.base_url)} · {valueText(row.description)}</small></div><label className="admin-switch"><input type="checkbox" checked={Boolean(row.is_enabled)} onChange={e=>updateRow("api_integrations",String(row.id),{is_enabled:e.target.checked},"Integration status updated.")}/><span/></label></div>)}</div>;
    if(section==="developer")return <div className="admin-records">{filtered.map(row=><div className="admin-record" key={String(row.id)}><div className="admin-record-icon"><BookOpen size={18}/></div><div className="admin-record-main"><strong>{valueText(row.title)}</strong><small>{valueText(row.resource_type)} · {valueText(row.url)} · {valueText(row.description)}</small></div><label className="admin-switch"><input type="checkbox" checked={Boolean(row.is_published)} onChange={e=>updateRow("developer_resources",String(row.id),{is_published:e.target.checked},"Resource visibility updated.")}/><span/></label></div>)}</div>;
    if(section==="settings"||section==="appearance")return <div className="admin-records">{filtered.map(row=><div className="admin-record" key={String(row.key)}><div className="admin-record-icon"><Settings size={18}/></div><div className="admin-record-main"><strong>{valueText(row.key)}</strong><small>{valueText(row.value)}</small></div><span className="admin-tag">Saved</span></div>)}</div>;
    if(section==="support")return <div className="admin-records">{filtered.map(row=><div className="admin-record" key={String(row.id)}><div className="admin-record-icon"><Ticket size={18}/></div><div className="admin-record-main"><strong>{valueText(row.subject)}</strong><small>{valueText(row.message)} · {dateText(row.created_at)}</small></div><select value={valueText(row.status)} onChange={e=>updateStatus(String(row.id),e.target.value)}><option value="open">Open</option><option value="in_progress">In progress</option><option value="closed">Closed</option></select></div>)}</div>;
    return <div className="admin-table-wrap"><table><thead><tr>{(filtered[0]?Object.keys(filtered[0]).slice(0,7):["Records"]).map(k=><th key={k}>{k.replaceAll("_"," ")}</th>)}</tr></thead><tbody>{filtered.map((row,i)=><tr key={String(row.id||i)}>{Object.keys(row).slice(0,7).map(k=><td key={k}>{k.includes("created_at")||k.includes("updated_at")?dateText(row[k]):valueText(row[k]).slice(0,120)}</td>)}</tr>)}</tbody></table></div>;
  };

  const newUsers=dash?sum(dash.users30):0;
  const newSearches=dash?sum(dash.searches30):0;
  const statCards:{label:string;value:number;icon:typeof Users;money?:boolean;sub:string;up?:boolean}[]=[
    {label:"Total Users",value:counts.profiles||0,icon:Users,sub:"↑ +"+newUsers+" in last 30 days",up:true},
    {label:"Active Plans",value:dash?dash.plans.filter(p=>p.is_active).length:0,icon:Gem,sub:(counts.premium_plans||0)+" plans total"},
    {label:"Total Searches",value:counts.search_history||0,icon:Wrench,sub:"↑ +"+newSearches+" in last 30 days",up:true},
    {label:"Total Revenue",value:dash?dash.revenue:0,icon:Coins,money:true,sub:(counts.payment_records||0)+" payment records"}
  ];
  const host=(()=>{try{return new URL(envUrl||"").hostname;}catch{return "—";}})();
  const nowText=new Date().toLocaleString("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:true});
  const initial=(v:unknown)=>String(v||"U").trim().charAt(0).toUpperCase()||"U";

  return <div className="admin-app">
    <aside className={"admin-sidebar"+(collapsed?" collapsed":"")}>
      <div className="admin-brand"><Logo size={74}/><div><b>Cyber<span>X</span> OSINT</b><small>Admin Panel v1.0.0</small></div></div>
      <div className="admin-nav-scroll"><div className="admin-nav-group">{navKeys.map(key=>{const item=sections.find(s=>s.key===key)!;const Icon=item.icon;return <button key={key} className={section===key?"active":""} onClick={()=>{setSection(key);setSearch("");setMessage("");}}><Icon size={18}/>{item.label}</button>;})}</div></div>
      <a className="admin-site-btn" href="/" target="_blank" rel="noreferrer">View Website ↗</a>
      <div className="admin-sidebar-foot"><div className="admin-avatar">{initial(adminName)}</div><div><b>{adminName}</b><small>Super Admin · Online</small></div><button title="Logout" onClick={logout}><LogOut size={17}/></button></div>
    </aside>
    <main className="admin-main">
      <header className="admin-topbar">
        <div className="admin-title-wrap"><button className="admin-hamb" aria-label="Toggle menu" onClick={()=>setCollapsed(c=>!c)}><Menu size={22}/></button><div><h1>{section==="dashboard"?"Admin Panel":active.label}</h1><div className="admin-welcome-line">Welcome back, {adminName}! 👑</div></div></div>
        <div className="admin-top-actions"><span className="admin-online"><i/> Site Status : Online</span><span className="admin-date">{nowText}</span><button className="admin-bell" title="Open support tickets" onClick={()=>setSection("support")}><Bell size={17}/>{openTickets>0&&<i>{openTickets}</i>}</button><button title="Refresh" onClick={()=>{void loadRows();void loadCounts();if(section==="dashboard")void loadDash();}}><RefreshCw size={17}/></button><div className="admin-profile"><div className="admin-top-avatar">{initial(adminName)}</div><ChevronDown size={16}/></div></div>
      </header>
      {section!=="dashboard"&&<div className="admin-subtitle">{active.description}</div>}
      {message&&<div className="admin-message"><CheckCircle2 size={16}/>{message}<button onClick={()=>setMessage("")}><X size={15}/></button></div>}

      {section==="dashboard"&&<>
        <div className="admin-stat-grid">{statCards.map(c=>{const Icon=c.icon;return <div className="admin-stat" key={c.label}><div><small>{c.label}</small><b>{c.money?"₹":""}{c.value.toLocaleString()}</b><em className={c.up?"admin-up":"admin-flat"}>{c.sub}</em></div><span><Icon size={24}/></span></div>;})}</div>
        <div className="admin-grid2">
          <div className="admin-panel"><h3><BarChart3 size={18}/> Analytics Overview <small style={{marginLeft:"auto",color:"#8fa6cc",fontWeight:500}}>Last 30 Days</small></h3>{dash?<><Chart a={dash.users30} b={dash.searches30} start={dash.start}/><div className="admin-legend"><span><i style={{background:"#27c8ff"}}/>New users</span><span><i style={{background:"#fff"}}/>Searches</span></div></>:<div className="admin-empty"><div className="admin-spinner"/>Loading analytics…</div>}</div>
          <div className="admin-panel"><h3><Zap size={18}/> Quick Actions</h3><div className="admin-quick-grid">{([["tools","Add Tool",Wrench],["users","Manage Users",Users],["users","Give Credits",Coins],["announcements","Send Broadcast",Send],["settings","Update Site",Settings],["logs","View Logs",FileText]] as [SectionKey,string,typeof Shield][]).map(([k,l,I])=><button key={l} onClick={()=>setSection(k)}><I size={26}/>{l}</button>)}</div></div>
        </div>
        <div className="admin-grid2b">
          <div className="admin-panel"><div className="admin-panel-head"><h3><Users size={18}/> Recent Users</h3><button className="admin-small" onClick={()=>setSection("users")}>View All →</button></div>{dash?.recent.length?<div className="admin-table-wrap"><table className="admin-mini"><thead><tr><th>#</th><th>Username</th>{dash.recent.some(r=>r.email)&&<th>Email</th>}<th>Role</th><th>Join Date</th><th>Status</th></tr></thead><tbody>{dash.recent.map((r,i)=><tr key={String(r.id)}><td>{i+1}</td><td><span className="admin-uav">{initial(r.display_name||r.username)}</span>{valueText(r.display_name||r.username||"User")}</td>{dash.recent.some(x=>x.email)&&<td>{valueText(r.email)}</td>}<td><span className={"admin-badge"+(r.role==="admin"?" prem":"")}>{valueText(r.role)}</span></td><td>{dateText(r.created_at)}</td><td><span className={"admin-badge"+(r.status==="active"?" ok":" bad")}>{valueText(r.status)}</span></td></tr>)}</tbody></table></div>:<div className="admin-empty">No users yet.</div>}</div>
          <div className="admin-panel"><div className="admin-panel-head"><h3><Wrench size={18}/> Tools Management</h3><button className="admin-small" onClick={()=>setSection("tools")}>View All →</button></div>{dash?.toolRows.length?<div className="admin-table-wrap"><table className="admin-mini"><thead><tr><th>Tool Name</th><th>Status</th><th>Action</th></tr></thead><tbody>{dash.toolRows.map(r=><tr key={String(r.id)}><td>{valueText(r.name)}</td><td><span className={"admin-badge"+(r.enabled?" ok":" bad")}>{r.enabled?"Active":"Disabled"}</span></td><td><label className="admin-switch" style={{display:"inline-block",verticalAlign:"middle",marginRight:10}}><input type="checkbox" checked={Boolean(r.enabled)} onChange={e=>toggleTool(String(r.id),e.target.checked)}/><span/></label><button className="admin-ibtn" title="Edit" onClick={()=>setSection("tools")}><Pencil size={14}/></button><button className="admin-ibtn red" title="Delete" onClick={()=>deleteRow("tools",String(r.id),valueText(r.name))}><Trash2 size={14}/></button></td></tr>)}</tbody></table></div>:<div className="admin-empty">No tools configured.</div>}</div>
        </div>
        <div className="admin-grid3">
          <div className="admin-panel"><div className="admin-panel-head"><h3><Crown size={18}/> Premium Plans</h3><button className="admin-small" onClick={()=>setSection("plans")}>View All →</button></div>{dash?.plans.length?<table className="admin-mini"><thead><tr><th>Plan Name</th><th>Price</th><th>Credits</th><th>Status</th><th>Action</th></tr></thead><tbody>{dash.plans.map(r=><tr key={String(r.id)}><td>{valueText(r.name)}</td><td>₹{valueText(r.price_inr)}</td><td>{valueText(r.credits)}</td><td><span className={"admin-badge"+(r.is_active?" ok":" bad")}>{r.is_active?"Active":"Off"}</span></td><td><button className="admin-ibtn" title="Edit" onClick={()=>setSection("plans")}><Pencil size={14}/></button><button className="admin-ibtn red" title="Delete" onClick={()=>deleteRow("premium_plans",String(r.id),valueText(r.name))}><Trash2 size={14}/></button></td></tr>)}</tbody></table>:<div className="admin-empty">No plans yet.</div>}<button className="admin-primary" onClick={()=>setSection("plans")}><Plus size={16}/> Add Plan</button></div>
          <div className="admin-panel"><div className="admin-panel-head"><h3><Settings size={18}/> Site Settings</h3><button className="admin-small" onClick={saveSite}>Quick Update</button></div><div className="admin-site-form"><label>Site Name<input value={siteForm.site_name||""} onChange={e=>setSiteForm(v=>({...v,site_name:e.target.value}))}/></label><label>Site URL<input value={siteForm.site_url||""} onChange={e=>setSiteForm(v=>({...v,site_url:e.target.value}))}/></label><label>Default Credits<input inputMode="numeric" value={siteForm.default_credits||""} onChange={e=>setSiteForm(v=>({...v,default_credits:e.target.value}))}/></label></div><button className="admin-primary" onClick={saveSite}>Save Settings</button></div>
          <div className="admin-panel"><h3><Server size={18}/> System Information</h3><div className="admin-info-grid" style={{gridTemplateColumns:"1fr 1fr"}}><div><small>Framework</small><b>Next.js 15</b></div><div><small>Database</small><b style={{color:counts.profiles!==undefined?"#27d98b":undefined}}>{counts.profiles!==undefined?"Connected":"Checking…"}</b></div><div><small>Auth</small><b>Supabase</b></div><div><small>Environment</small><b>{process.env.NODE_ENV}</b></div><div style={{gridColumn:"1/-1"}}><small>Supabase host</small><b className="mono">{host}</b></div></div><div className="admin-online" style={{marginTop:12,justifyContent:"center"}}><i/> All Systems Operational</div></div>
        </div>
      </>}

      {section==="analytics"&&<div className="admin-stat-grid">{Object.entries(counts).map(([key,value])=><div className="admin-stat" key={key}><div><small>{key.replaceAll("_"," ")}</small><b>{value.toLocaleString()}</b></div><span><Activity size={21}/></span></div>)}</div>}
      {section==="system"&&<div className="admin-panel"><h3><Gauge size={18}/> Runtime information</h3><div className="admin-info-grid"><div><small>Framework</small><b>Next.js 15</b></div><div><small>Runtime</small><b>Node.js</b></div><div><small>Database</small><b>Supabase PostgreSQL</b></div><div><small>Authentication</small><b>Supabase Auth</b></div><div><small>Admin authorization</small><b>Database role + RLS</b></div><div><small>Environment</small><b>{process.env.NODE_ENV}</b></div></div><p className="admin-hint">Only configured integrations are reported; CPU, storage and uptime come from your hosting provider’s dashboard.</p></div>}
      {section==="backup"&&<div className="admin-panel"><h3><Database size={18}/> Backup & Restore</h3><div className="admin-warning">Database backups are controlled by your Supabase project and plan. This page does not claim to create a backup from the browser.</div><ol className="admin-steps"><li>Open your Supabase project dashboard.</li><li>Use Database backups / Point-in-Time Recovery if enabled on your plan.</li><li>Before restoring, verify the target project and the backup timestamp.</li><li>After restore, run the app build and verify Auth, RLS and table access.</li></ol><a className="admin-primary-link" href="https://supabase.com/dashboard/projects" target="_blank" rel="noreferrer">Open Supabase dashboard <ArrowRight size={15}/></a></div>}
      {section==="about"&&<div className="admin-panel" style={{textAlign:"center"}}><Logo size={90}/><h2>CyberX OSINT</h2><p>Public-source research workspace with a mobile-first interface and database-protected administration.</p><div className="admin-warning">Safety scope: public technical metadata and public links only. No private-person tracking, account intrusion, password discovery, leaked personal-data search, or precise location claims.</div><a className="admin-primary-link" href="https://github.com/Xcyberking/CyberOsintIndia" target="_blank" rel="noreferrer">Repository <ArrowRight size={15}/></a></div>}

      {active.table&&<section className="admin-panel admin-data-panel"><div className="admin-panel-head"><div><h3>{active.label}</h3><small>{rows.length} records loaded · maximum 100 shown</small></div><div className="admin-data-actions"><div className="admin-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search records…"/></div><button onClick={()=>void loadRows()}><RefreshCw size={16}/></button></div></div>
        {addable&&<div className="admin-add-form"><h4><Plus size={16}/> Add {section==="plans"?"plan":section==="announcements"?"announcement":section==="api"?"integration":section==="developer"?"resource":"setting"}</h4><div className="admin-form-grid"><input placeholder={section==="settings"||section==="appearance"?"Setting key":"Name / title"} value={form.name||""} onChange={e=>setForm(v=>({...v,name:e.target.value}))}/>{section==="plans"&&<input placeholder="Price (INR)" value={form.price||""} onChange={e=>setForm(v=>({...v,price:e.target.value}))}/>}{section==="plans"&&<><input placeholder="Credits" value={form.credits||""} onChange={e=>setForm(v=>({...v,credits:e.target.value}))}/><input placeholder="Duration days" value={form.duration||"30"} onChange={e=>setForm(v=>({...v,duration:e.target.value}))}/></>}{(section==="api"||section==="developer")&&<input placeholder="Public URL" value={form.url||""} onChange={e=>setForm(v=>({...v,url:e.target.value}))}/>}{section==="developer"&&<input placeholder="Resource type" value={form.type||"documentation"} onChange={e=>setForm(v=>({...v,type:e.target.value}))}/>}{section==="settings"||section==="appearance"?<textarea placeholder='JSON value, e.g. {"theme":"blue"}' value={form.value||""} onChange={e=>setForm(v=>({...v,value:e.target.value}))}/>:<textarea placeholder="Description / body" value={form.description||""} onChange={e=>setForm(v=>({...v,description:e.target.value}))}/>}</div><div className="admin-form-foot"><label><input type="checkbox" checked={form.enabled==="true"} onChange={e=>setForm(v=>({...v,enabled:e.target.checked?"true":"false"}))}/> {section==="announcements"?"Publish now":section==="api"?"Enable integration":"Enabled"}</label><button className="admin-primary" disabled={saving||!form.name?.trim()} onClick={saveRecord}>{saving?"Saving…":"Save record"}</button></div></div>}
        {section==="tools"&&<div className="admin-add-form"><h4><Plus size={16}/> Add tool</h4><div className="admin-form-grid"><input placeholder="Tool name" value={form.name||""} onChange={e=>setForm(v=>({...v,name:e.target.value}))}/><input placeholder="Category" value={form.category||""} onChange={e=>setForm(v=>({...v,category:e.target.value}))}/><textarea placeholder="Description" value={form.description||""} onChange={e=>setForm(v=>({...v,description:e.target.value}))}/></div><div className="admin-form-foot"><span className="admin-hint" style={{margin:0}}>New tools are enabled by default. A tool only works in the app once its feature code exists.</span><button className="admin-primary" disabled={saving||!form.name?.trim()} onClick={saveRecord}>{saving?"Saving…":"Save record"}</button></div></div>}
        {renderRows()}
      </section>}
    </main>
  </div>;
}
