"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient, type User as AuthUser } from "@supabase/supabase-js";
import {
  Activity, ArrowDownToLine, ArrowLeft, ArrowRight, Bell, BookOpen, CheckCircle2,
  ChevronRight, CircleHelp, Code2, Coins, CreditCard, Database, FileClock,
  FileText, Gauge, Globe2, LayoutDashboard, LockKeyhole, LogOut, Megaphone,
  Palette, Plus, RefreshCw, Search, Settings, Shield, ShieldCheck, SlidersHorizontal,
  Sparkles, Ticket, Users, Wrench, X, Zap, Crown, Ban, Server, Link2, Github, Chrome
} from "lucide-react";
import "./admin.css";

type Row = Record<string, unknown>;
type SectionKey = "dashboard"|"users"|"banned"|"tools"|"plans"|"payments"|"credits"|"referrals"|"settings"|"appearance"|"announcements"|"api"|"backup"|"logs"|"developer"|"support"|"analytics"|"system"|"about";
type Section = { key: SectionKey; label: string; table?: string; description: string; icon: typeof Shield; };
const sections: Section[] = [
  {key:"dashboard",label:"Dashboard",description:"Overview of your OSINT workspace",icon:LayoutDashboard},
  {key:"users",label:"User Management",table:"profiles",description:"Review accounts, roles, status and credit balances",icon:Users},
  {key:"banned",label:"Banned Users",table:"profiles",description:"Review suspended and banned accounts",icon:Ban},
  {key:"tools",label:"Tools Management",table:"tools",description:"Enable, disable and organize public-source tools",icon:Wrench},
  {key:"plans",label:"Premium Plans",table:"premium_plans",description:"Manage plan names, prices, credits and duration",icon:Crown},
  {key:"payments",label:"Payments",table:"payment_records",description:"Review payment records and statuses",icon:CreditCard},
  {key:"credits",label:"Credits",table:"credit_transactions",description:"Audit credit grants and deductions",icon:Coins},
  {key:"referrals",label:"Referral System",table:"referral_claims",description:"Review referral qualification and rewards",icon:Users},
  {key:"settings",label:"Site Settings",table:"site_settings",description:"Store public site configuration",icon:Settings},
  {key:"appearance",label:"Appearance",table:"site_settings",description:"Manage theme and branding settings",icon:Palette},
  {key:"announcements",label:"Announcements",table:"announcements",description:"Publish service notices and updates",icon:Megaphone},
  {key:"api",label:"API Management",table:"api_integrations",description:"Manage public API endpoint configuration",icon:Link2},
  {key:"backup",label:"Backup & Restore",description:"Database backup guidance and restore checklist",icon:Database},
  {key:"logs",label:"Logs & Activity",table:"admin_audit_logs",description:"Review administrative actions",icon:FileClock},
  {key:"developer",label:"Developer Hub",table:"developer_resources",description:"Manage documentation and developer resources",icon:Code2},
  {key:"support",label:"Support Center",table:"support_tickets",description:"Review user support requests",icon:Ticket},
  {key:"analytics",label:"Site Analytics",description:"Live counts from your configured database tables",icon:Activity},
  {key:"system",label:"System Information",description:"Runtime and service configuration status",icon:Server},
  {key:"about",label:"About CyberX OSINT",description:"Project details and safety boundaries",icon:ShieldCheck}
];
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

export default function AdminPage() {
  const [section,setSection]=useState<SectionKey>("dashboard");
  const [authUser,setAuthUser]=useState<AuthUser|null>(null);
  const [isAdmin,setIsAdmin]=useState(false);
  const [checking,setChecking]=useState(true);
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [message,setMessage]=useState("");
  const [rows,setRows]=useState<Row[]>([]);
  const [loading,setLoading]=useState(false);
  const [search,setSearch]=useState("");
  const [form,setForm]=useState<Record<string,string>>({});
  const [saving,setSaving]=useState(false);
  const [counts,setCounts]=useState<Record<string,number>>({});
  const [userEdits,setUserEdits]=useState<Record<string,{role:string;status:string;delta:string;reason:string}>>({});
  const [editingToolId,setEditingToolId]=useState<string>("");
  const [gatewayKeyId,setGatewayKeyId]=useState("");
  const [gatewayKeySecret,setGatewayKeySecret]=useState("");
  const [gatewayEnabled,setGatewayEnabled]=useState(false);
  const [gatewaySaving,setGatewaySaving]=useState(false);
  const [gatewayMessage,setGatewayMessage]=useState("");
  const [qrUploading,setQrUploading]=useState(false);
  const [ticketReplies,setTicketReplies]=useState<Record<string,string>>({});
  const [bulkCreditDelta,setBulkCreditDelta]=useState("5");
  const [bulkCreditReason,setBulkCreditReason]=useState("Administrator bulk credit grant");
  const [bulkCreditBusy,setBulkCreditBusy]=useState(false);
  const [planEdits,setPlanEdits]=useState<Record<string,string>>({});
  const [adminPlans,setAdminPlans]=useState<{id:string;name:string;credits:number;duration_days:number}[]>([]);

  const verify=useCallback(async()=>{
    if(!supabase){setChecking(false);return;}
    setChecking(true);
    const {data:{user},error:authError}=await supabase.auth.getUser();
    if(authError){setAuthUser(null);setIsAdmin(false);setMessage(authError.message);setChecking(false);return;}
    setAuthUser(user);
    if(user){
      // First verify by immutable Auth user ID. If an older profile was created
      // before Auth identity linking, allow an exact verified-email match only
      // when that database profile is already explicitly admin + active.
      let profileQuery=await supabase.from("profiles").select("id,email,role,status").eq("id",user.id).maybeSingle();
      if(!profileQuery.data && !profileQuery.error && user.email && user.email_confirmed_at){
        profileQuery=await supabase.from("profiles").select("id,email,role,status").ilike("email",user.email).maybeSingle();
      }
      const profile=profileQuery.data;
      if(profileQuery.error){
        setIsAdmin(false);
        setMessage("Admin verification could not read your profile: "+profileQuery.error.message);
      } else {
        const verifiedEmailMatch=Boolean(user.email_confirmed_at && user.email &&
          profile?.email?.toLowerCase()===user.email.toLowerCase());
        const sameAuthUser=profile?.id===user.id;
        const allowed=(sameAuthUser || verifiedEmailMatch) &&
          profile?.role==="admin" && profile?.status==="active";
        setIsAdmin(allowed);
        if(!allowed) setMessage("Signed in as "+(user.email||"an account")+", but this Auth identity is not linked to an active admin profile. Sign in with the email/password account or link its OAuth identity in Supabase.");
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
      // Defer Supabase API calls until after the auth event callback returns.
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
    const tables=["profiles","tools","premium_plans","payment_records","support_tickets","referral_claims"];
    const results=await Promise.all(tables.map(async table=>{
      const {count}=await supabase.from(table).select("*",{count:"exact",head:true});
      return [table,count||0] as const;
    }));
    setCounts(Object.fromEntries(results));
  },[isAdmin]);
  useEffect(()=>{void loadCounts();},[loadCounts]);
  useEffect(()=>{
    if(!supabase||!isAdmin)return;
    void supabase.from("premium_plans").select("id,name,credits,duration_days").order("name").then(({data})=>setAdminPlans((data||[]) as typeof adminPlans));
  },[isAdmin]);

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
    const {error}=await supabase.auth.signInWithOAuth({
      provider,
      options:{
        redirectTo,
        scopes:provider==="github"?"read:user user:email":"openid email profile"
      }
    });
    if(error)setMessage(error.message);
  }
  async function logout(){if(supabase)await supabase.auth.signOut();setAuthUser(null);setIsAdmin(false);setMessage("");}

  async function saveRecord(){
    if(!supabase||!active.table)return;
    setSaving(true);setMessage("");
    let payload:Row={};
    if(section==="tools") {
      const apiUrl=(form.url||"").trim();
      if(!/^https:\/\//i.test(apiUrl) || (apiUrl.match(/\{\}/g)||[]).length!==1){setMessage("Tool API URL must use HTTPS and contain exactly one {} query placeholder.");setSaving(false);return;}
      try{const parsed=new URL(apiUrl.replace("{}", "sample"));if(!["https:"].includes(parsed.protocol))throw new Error();}catch{setMessage("Enter a valid HTTPS API URL.");setSaving(false);return;}
      payload={slug:(form.name||"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""),name:form.name||"",description:form.description||"",category:form.category||"Research",handler:"custom",input_label:form.input_label||"Enter query",credit_cost:Math.max(0,Number(form.credit_cost||0)),enabled:form.enabled==="true",config:{api_url:apiUrl,icon:form.icon||"Wrench"}};
    }
    else if(section==="plans") payload={name:form.name||"",description:form.description||"",price_inr:Number(form.price||0),credits:Number(form.credits||0),duration_days:Number(form.duration||30),is_active:true};
    else if(section==="announcements") payload={title:form.name||"",body:form.description||"",active:form.enabled==="true",is_published:form.enabled==="true",created_by:authUser?.id};
    else if(section==="api") payload={name:form.name||"",base_url:form.url||"",description:form.description||"",is_enabled:form.enabled==="true"};
    else if(section==="developer") payload={title:form.name||"",resource_type:form.type||"documentation",url:form.url||"",description:form.description||"",is_published:true};
    else if(section==="settings"||section==="appearance"){
      let parsed:unknown;
      try{parsed=JSON.parse(form.value||"{}");}catch{setMessage("Value must be valid JSON.");setSaving(false);return;}
      payload={key:form.name||"",value:parsed,updated_by:authUser?.id,updated_at:new Date().toISOString()};
    } else {setSaving(false);return;}
    const {error}=await (section==="settings"||section==="appearance" ? supabase.from(active.table).upsert(payload) : section==="tools"&&editingToolId ? supabase.from("tools").update(payload).eq("id",editingToolId) : supabase.from(active.table).insert(payload));
    if(error)setMessage(error.message);
    else {setForm({});setEditingToolId("");setMessage("Saved successfully.");await loadRows();await loadCounts();}
    setSaving(false);
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
    setMessage(error?error.message:"Ticket updated.");if(!error)await loadRows();
  }
  async function replyToTicket(id:string){
    if(!supabase)return;
    const reply=(ticketReplies[id]||"").trim();
    if(reply.length<2){setMessage("Write a reply before sending.");return;}
    const {error}=await supabase.from("support_tickets").update({admin_reply:reply.slice(0,5000),status:"in_progress",updated_at:new Date().toISOString()}).eq("id",id);
    setMessage(error?error.message:"Reply sent to the user.");
    if(!error){setTicketReplies(v=>({...v,[id]:""}));await loadRows();}
  }
  async function bulkGrantCredits(){
    if(!supabase)return;
    const delta=Number(bulkCreditDelta);
    if(!Number.isInteger(delta)||delta===0||Math.abs(delta)>100000){setMessage("Enter a whole-number credit amount between -100000 and 100000, excluding zero.");return;}
    if(!window.confirm((delta>0?"Add ":"Deduct ")+Math.abs(delta)+" credits for every user?"))return;
    setBulkCreditBusy(true);
    const {data,error}=await supabase.rpc("admin_bulk_grant_credits",{p_credit_delta:delta,p_reason:bulkCreditReason.trim()||"Administrator bulk credit grant",p_target_user_id:null});
    setMessage(error?error.message:"Credits updated for "+String(data??0)+" users.");
    if(!error){await loadCounts();if(section==="users"||section==="credits")await loadRows();}
    setBulkCreditBusy(false);
  }
  async function assignPlanToUser(userId:string){
    if(!supabase)return;
    const planId=planEdits[userId];
    if(!planId){setMessage("Choose a plan first.");return;}
    const {error}=await supabase.rpc("admin_assign_plan",{p_target_user_id:userId,p_plan_id:planId,p_add_credits:true});
    setMessage(error?error.message:"Plan assigned and its credits added.");
    if(!error){setPlanEdits(v=>({...v,[userId]:""}));await loadRows();}
  }
  async function publishAnnouncement(id:string,published:boolean){
    if(!supabase)return;
    const {error}=await supabase.from("announcements").update({is_published:published,active:published}).eq("id",id);
    setMessage(error?error.message:"Announcement updated.");if(!error)await loadRows();
  }
  async function editTool(row:Row){setEditingToolId(String(row.id));const config=(row.config&&typeof row.config==="object"?row.config:{}) as Record<string,string>;setForm({name:valueText(row.name),description:valueText(row.description),category:valueText(row.category),url:config.api_url||"",icon:config.icon||"Wrench",credit_cost:valueText(row.credit_cost),input_label:valueText(row.input_label),enabled:String(Boolean(row.enabled))});setMessage("Editing "+valueText(row.name));}
  async function deleteTool(id:string){if(!supabase||!window.confirm("Delete this tool permanently?"))return;const {error}=await supabase.from("tools").delete().eq("id",id);setMessage(error?error.message:"Tool deleted.");if(!error){if(editingToolId===id){setEditingToolId("");setForm({});}await loadRows();await loadCounts();}}
  async function toggleTool(id:string,enabled:boolean){
    if(!supabase)return;
    const {error}=await supabase.from("tools").update({enabled}).eq("id",id);
    setMessage(error?error.message:"Tool status updated.");if(!error)await loadRows();
  }
  async function updateRow(table:string,id:string,patch:Row,success:string){
    if(!supabase)return;
    const {error}=await supabase.from(table).update(patch).eq("id",id);
    setMessage(error?error.message:success);if(!error)await loadRows();
  }


  useEffect(()=>{
    if(!supabase||!isAdmin||!(section==="settings"||section==="payments"))return;
    let active=true;
    void supabase.functions.invoke("payment-gateway",{body:{action:"public_config"}}).then(({data,error})=>{
      if(!active)return;
      if(error){setGatewayMessage("Gateway status: "+error.message);return;}
      setGatewayKeyId(String(data?.key_id||""));
      setGatewayEnabled(Boolean(data?.enabled));
    });
    return ()=>{active=false;};
  },[isAdmin,section]);

  async function saveGateway(){
    if(!supabase)return;
    setGatewaySaving(true);setGatewayMessage("");
    const {data,error}=await supabase.functions.invoke("payment-gateway",{body:{
      action:"save_config",key_id:gatewayKeyId.trim(),key_secret:gatewayKeySecret.trim(),enabled:gatewayEnabled
    }});
    if(error||data?.error)setGatewayMessage(error?.message||data.error);
    else {setGatewayKeySecret("");setGatewayMessage("Razorpay settings saved securely. Secret is encrypted and never returned to the browser.");}
    setGatewaySaving(false);
  }

  async function uploadPaymentQr(file:File){
    if(!supabase)return;
    if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>2*1024*1024){setGatewayMessage("QR must be PNG, JPG or WebP and no larger than 2 MB.");return;}
    setQrUploading(true);setGatewayMessage("");
    const reader=new FileReader();
    reader.onload=async()=>{
      const value=String(reader.result||"");
      if(!value.startsWith("data:image/")){setGatewayMessage("Could not read the QR image.");setQrUploading(false);return;}
      const {error}=await supabase!.from("site_settings").upsert({key:"payment_qr_url",value,updated_by:authUser?.id,updated_at:new Date().toISOString()},{onConflict:"key"});
      setGatewayMessage(error?error.message:"Payment QR uploaded and published to the Store.");
      setQrUploading(false);
    };
    reader.onerror=()=>{setGatewayMessage("QR file could not be read.");setQrUploading(false);};
    reader.readAsDataURL(file);
  }

  const filtered=useMemo(()=>rows.filter(row=>JSON.stringify(row).toLowerCase().includes(search.toLowerCase())),[rows,search]);
  const recordCount=Object.values(counts).reduce((a,b)=>a+b,0);
  const addable=["tools","plans","announcements","api","developer","settings","appearance"].includes(section);

  if(checking)return <div className="admin-loading"><div className="admin-spinner"/>Checking admin access…</div>;
  if(!supabase)return <div className="admin-auth"><div className="admin-auth-card"><div className="admin-logo"><Shield size={30}/></div><h1>Cyber<span>X</span> OSINT</h1><p>Admin panel configuration required</p><div className="admin-warning">Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in your hosting environment, then redeploy.</div><a href="https://github.com/Xcyberking/CyberOsintIndia" target="_blank" rel="noreferrer">Open project repository <ArrowRight size={15}/></a></div></div>;
  if(!authUser||!isAdmin)return <div className="admin-auth"><div className="admin-auth-card"><div className="admin-logo"><Shield size={30}/></div><h1>Cyber<span>X</span> OSINT</h1><p>{authUser?"This account does not have active admin access.":"Secure administrator sign in"}</p>{!authUser&&<><label>Email address</label><input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="admin@example.com"/><label>Password</label><input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Your password"/><button className="admin-primary" onClick={login}><LockKeyhole size={16}/> Admin Login</button><div className="admin-oauth-divider"><span>OR CONTINUE WITH</span></div><div className="admin-oauth-grid"><button type="button" onClick={()=>void oauthLogin("google")}><Chrome size={16}/> Google</button><button type="button" onClick={()=>void oauthLogin("github")}><Github size={16}/> GitHub</button></div></>}{message&&<div className="admin-message">{message}</div>}{authUser&&!isAdmin&&<button className="admin-primary" onClick={()=>void logout()}><LogOut size={16}/> Sign out / switch account</button>}<div className="admin-auth-note">OAuth login is real Supabase Auth. Only an account whose database profile has role=admin and status=active can enter this panel.</div></div></div>;

  const navGroups=[
    {title:"OVERVIEW",keys:["dashboard","analytics","system"] as SectionKey[]},
    {title:"MANAGEMENT",keys:["users","banned","tools","plans","payments","credits","referrals"] as SectionKey[]},
    {title:"CONFIGURATION",keys:["settings","appearance","announcements","api","backup"] as SectionKey[]},
    {title:"OPERATIONS",keys:["logs","developer","support","about"] as SectionKey[]}
  ];
  const renderRows=()=>{
    if(loading)return <div className="admin-empty"><div className="admin-spinner"/>Loading records…</div>;
    if(!filtered.length)return <div className="admin-empty">No records found. Apply the database setup SQL and add your first records.</div>;
    if(section==="users"||section==="banned")return <div className="admin-table-wrap"><table><thead><tr><th>User ID</th><th>Username</th><th>Role</th><th>Status</th><th>Credits</th><th>Credit / plan actions</th></tr></thead><tbody>{filtered.map(row=><tr key={String(row.id)}><td className="mono">{String(row.id).slice(0,8)}…</td><td>{valueText(row.display_name||row.username||"User")}<small>{valueText(row.username)}</small></td><td><select value={userEdits[String(row.id)]?.role||valueText(row.role)} onChange={e=>setUserEdits(v=>({...v,[String(row.id)]:{role:e.target.value,status:v[String(row.id)]?.status||valueText(row.status),delta:v[String(row.id)]?.delta||"0",reason:v[String(row.id)]?.reason||"Admin adjustment"}}))}><option value="user">User</option><option value="moderator">Moderator</option><option value="admin">Admin</option></select></td><td><select value={userEdits[String(row.id)]?.status||valueText(row.status)} onChange={e=>setUserEdits(v=>({...v,[String(row.id)]:{role:v[String(row.id)]?.role||valueText(row.role),status:e.target.value,delta:v[String(row.id)]?.delta||"0",reason:v[String(row.id)]?.reason||"Admin adjustment"}}))}><option value="active">Active</option><option value="suspended">Suspended</option><option value="banned">Banned</option></select></td><td>{valueText(row.credits)}</td><td><div className="admin-inline"><input aria-label="Credit adjustment" placeholder="+/- credits" value={userEdits[String(row.id)]?.delta||"0"} onChange={e=>setUserEdits(v=>({...v,[String(row.id)]:{role:v[String(row.id)]?.role||valueText(row.role),status:v[String(row.id)]?.status||valueText(row.status),delta:e.target.value,reason:v[String(row.id)]?.reason||"Admin adjustment"}}))}/><button className="admin-small" onClick={()=>updateUser(String(row.id))}>Save user</button><select value={planEdits[String(row.id)]||""} onChange={e=>setPlanEdits(v=>({...v,[String(row.id)]:e.target.value}))}><option value="">Assign plan…</option>{adminPlans.map(plan=><option key={plan.id} value={plan.id}>{plan.name} · {plan.credits} credits</option>)}</select><button className="admin-small" disabled={!planEdits[String(row.id)]} onClick={()=>void assignPlanToUser(String(row.id))}>Give plan</button></div></td></tr>)}</tbody></table></div>;
    if(section==="tools")return <div className="admin-records">{filtered.map(row=>{const cfg=(row.config&&typeof row.config==="object"?row.config:{}) as Record<string,string>;return <div className="admin-record" key={String(row.id)}><div className="admin-record-icon"><Wrench size={18}/></div><div className="admin-record-main"><strong>{valueText(row.name)}</strong><small>{valueText(row.description)} · {valueText(row.credit_cost)} credits/use</small><small className="mono">{cfg.api_url||"No API URL configured"}</small></div><label className="admin-switch"><input type="checkbox" checked={Boolean(row.enabled)} onChange={e=>toggleTool(String(row.id),e.target.checked)}/><span/></label><button className="admin-small" onClick={()=>void editTool(row)}>Edit</button><button className="admin-small" onClick={()=>void deleteTool(String(row.id))}>Delete</button></div>})}</div>;
    if(section==="announcements")return <div className="admin-records">{filtered.map(row=><div className="admin-record" key={String(row.id)}><div className="admin-record-icon"><Megaphone size={18}/></div><div className="admin-record-main"><strong>{valueText(row.title)}</strong><small>{valueText(row.body)}</small></div><button className="admin-small" onClick={()=>publishAnnouncement(String(row.id),!Boolean(row.is_published))}>{row.is_published?"Unpublish":"Publish"}</button></div>)}</div>;
    if(section==="plans")return <div className="admin-records">{filtered.map(row=><div className="admin-record" key={String(row.id)}><div className="admin-record-icon"><Crown size={18}/></div><div className="admin-record-main"><strong>{valueText(row.name)} · ₹{valueText(row.price_inr)}</strong><small>{valueText(row.credits)} credits · {valueText(row.duration_days)} days · {valueText(row.description)}</small></div><label className="admin-switch"><input type="checkbox" checked={Boolean(row.is_active)} onChange={e=>updateRow("premium_plans",String(row.id),{is_active:e.target.checked},"Plan status updated.")}/><span/></label></div>)}</div>;
    if(section==="payments")return <div className="admin-records">{filtered.map(row=><div className="admin-record" key={String(row.id)}><div className="admin-record-icon"><CreditCard size={18}/></div><div className="admin-record-main"><strong>₹{valueText(row.amount_inr)} · {valueText(row.provider)} · {valueText(row.status)}</strong><small>User: {String(row.user_id||"").slice(0,12)}… · Plan: {valueText(row.user_note||row.plan_id)}</small><small>UTR / reference: {valueText(row.provider_reference)} · {dateText(row.created_at)}</small>{Boolean(row.proof_url)&&<a href={String(row.proof_url)} target="_blank" rel="noreferrer">Open payment proof</a>}{Boolean(row.admin_note)&&<small>Admin note: {valueText(row.admin_note)}</small>}</div>{row.status==="pending"?<div className="admin-inline"><button className="admin-small" onClick={async()=>{if(!window.confirm("Confirm you checked the payment in the bank/UPI statement and received the money?"))return;const {error}=await supabase!.rpc("admin_review_payment",{p_payment_id:String(row.id),p_approve:true,p_admin_note:null});setMessage(error?error.message:"Payment approved; plan and credits applied.");if(!error){await loadRows();await loadCounts();}}}>Approve</button><button className="admin-small" onClick={async()=>{const note=window.prompt("Reason for rejection (optional):")||"";const {error}=await supabase!.rpc("admin_review_payment",{p_payment_id:String(row.id),p_approve:false,p_admin_note:note});setMessage(error?error.message:"Payment rejected.");if(!error)await loadRows();}}>Reject</button></div>:<span className="admin-tag">{valueText(row.status)}</span>}</div>)}</div>;
    if(section==="referrals")return <div className="admin-records">{filtered.map(row=><div className="admin-record" key={String(row.id)}><div className="admin-record-icon"><Users size={18}/></div><div className="admin-record-main"><strong>{valueText(row.referrer_id)} → {valueText(row.referred_id)}</strong><small>Reward: {valueText(row.reward)} credits · {dateText(row.created_at)}</small></div><select value={valueText(row.status)} onChange={e=>updateRow("referral_claims",String(row.id),{status:e.target.value},"Referral status updated. Credit reward is not automatically issued by this status change.")}><option value="pending">Pending</option><option value="qualified">Qualified</option><option value="rejected">Rejected</option></select></div>)}</div>;
    if(section==="api")return <div className="admin-records">{filtered.map(row=><div className="admin-record" key={String(row.id)}><div className="admin-record-icon"><Link2 size={18}/></div><div className="admin-record-main"><strong>{valueText(row.name)}</strong><small>{valueText(row.base_url)} · {valueText(row.description)}</small></div><label className="admin-switch"><input type="checkbox" checked={Boolean(row.is_enabled)} onChange={e=>updateRow("api_integrations",String(row.id),{is_enabled:e.target.checked},"Integration status updated.")}/><span/></label></div>)}</div>;
    if(section==="developer")return <div className="admin-records">{filtered.map(row=><div className="admin-record" key={String(row.id)}><div className="admin-record-icon"><BookOpen size={18}/></div><div className="admin-record-main"><strong>{valueText(row.title)}</strong><small>{valueText(row.resource_type)} · {valueText(row.url)} · {valueText(row.description)}</small></div><label className="admin-switch"><input type="checkbox" checked={Boolean(row.is_published)} onChange={e=>updateRow("developer_resources",String(row.id),{is_published:e.target.checked},"Resource visibility updated.")}/><span/></label></div>)}</div>;
    if(section==="settings"||section==="appearance")return <div className="admin-records">{filtered.map(row=><div className="admin-record" key={String(row.key)}><div className="admin-record-icon"><Settings size={18}/></div><div className="admin-record-main"><strong>{valueText(row.key)}</strong><small>{valueText(row.value)}</small></div><span className="admin-tag">Saved</span></div>)}</div>;
    if(section==="support")return <div className="admin-records">{filtered.map(row=><div className="admin-record admin-support-record" key={String(row.id)}><div className="admin-record-icon"><Ticket size={18}/></div><div className="admin-record-main"><strong>{valueText(row.subject)}</strong><small>User ID: {String(row.user_id||"").slice(0,14)}… · {dateText(row.created_at)}</small><p style={{whiteSpace:"pre-wrap",fontSize:13,lineHeight:1.6,margin:"9px 0"}}>{valueText(row.message)}</p>{Boolean(row.admin_reply)&&<div className="admin-support-reply"><b>Previous reply</b><p style={{whiteSpace:"pre-wrap",margin:"5px 0 0"}}>{valueText(row.admin_reply)}</p></div>}<textarea value={ticketReplies[String(row.id)]??""} onChange={e=>setTicketReplies(v=>({...v,[String(row.id)]:e.target.value}))} placeholder="Write a reply to this user…" rows={3}/><div className="admin-inline"><button className="admin-small" onClick={()=>void replyToTicket(String(row.id))}>Send reply</button><select value={valueText(row.status)} onChange={e=>updateStatus(String(row.id),e.target.value)}><option value="open">Open</option><option value="in_progress">In progress</option><option value="closed">Closed</option></select></div></div></div>)}</div>;
    return <div className="admin-table-wrap"><table><thead><tr>{(filtered[0]?Object.keys(filtered[0]).slice(0,7):["Records"]).map(k=><th key={k}>{k.replaceAll("_"," ")}</th>)}</tr></thead><tbody>{filtered.map((row,i)=><tr key={String(row.id||i)}>{Object.keys(row).slice(0,7).map(k=><td key={k}>{k.includes("created_at")||k.includes("updated_at")?dateText(row[k]):valueText(row[k]).slice(0,120)}</td>)}</tr>)}</tbody></table></div>;
  };

  return <div className="admin-app">
    <aside className="admin-sidebar">
      <div className="admin-brand"><div className="admin-brand-mark"><Shield size={24}/></div><div><b>Cyber<span>X</span> OSINT</b><small>ADMIN CONTROL CENTER</small></div></div>
      <div className="admin-nav-scroll">{navGroups.map(group=><div className="admin-nav-group" key={group.title}><div className="admin-nav-label">{group.title}</div>{group.keys.map(key=>{const item=sections.find(s=>s.key===key)!;const Icon=item.icon;return <button key={key} className={section===key?"active":""} onClick={()=>{setSection(key);setSearch("");setMessage("");}}><Icon size={17}/>{item.label}</button>;})}</div>)}</div>
      <div className="admin-sidebar-foot"><div className="admin-avatar">CX</div><div><b>{authUser.email}</b><small>Super Administrator</small></div><button title="Logout" onClick={logout}><LogOut size={17}/></button></div>
    </aside>
    <main className="admin-main">
      <header className="admin-topbar"><div><div className="admin-kicker">CYBERX OSINT / CONTROL CENTER</div><h1>{active.label}</h1></div><div className="admin-top-actions"><span className="admin-online"><i/> Admin access verified</span><a className="admin-small" href="/" style={{textDecoration:"none"}}>Open User App</a><button title="Refresh" onClick={()=>{void loadRows();void loadCounts();}}><RefreshCw size={17}/></button><button title="Notifications"><Bell size={17}/></button><div className="admin-top-avatar">CX</div></div></header>
      <div className="admin-subtitle">{active.description}</div>
      {message&&<div className="admin-message"><CheckCircle2 size={16}/>{message}<button onClick={()=>setMessage("")}><X size={15}/></button></div>}
      {section==="dashboard"&&<><section className="admin-welcome"><div><span>ADMINISTRATOR WORKSPACE</span><h2>Welcome back, CyberKing 👑</h2><p>Manage users, public-source tools, plans, credits and site operations from one place.</p></div><div className="admin-welcome-icon"><ShieldCheck size={48}/></div></section><div className="admin-stat-grid">{[{label:"Total users",value:counts.profiles||0,icon:Users},{label:"Available tools",value:counts.tools||0,icon:Wrench},{label:"Premium plans",value:counts.premium_plans||0,icon:Crown},{label:"Support tickets",value:counts.support_tickets||0,icon:Ticket},{label:"Payment records",value:counts.payment_records||0,icon:CreditCard},{label:"Referrals",value:counts.referral_claims||0,icon:Activity}].map(card=>{const Icon=card.icon;return <div className="admin-stat" key={card.label}><div><small>{card.label}</small><b>{card.value.toLocaleString()}</b></div><span><Icon size={21}/></span></div>})}</div><div className="admin-dashboard-grid"><div className="admin-panel"><h3><Zap size={18}/> Quick Actions</h3><div className="admin-quick-grid">{[{key:"users" as SectionKey,label:"Manage Users",icon:Users},{key:"tools" as SectionKey,label:"Manage Tools",icon:Wrench},{key:"plans" as SectionKey,label:"Premium Plans",icon:Crown},{key:"announcements" as SectionKey,label:"Announcement",icon:Megaphone},{key:"api" as SectionKey,label:"API Settings",icon:Link2},{key:"logs" as SectionKey,label:"View Logs",icon:FileClock}].map(a=>{const Icon=a.icon;return <button key={a.key} onClick={()=>setSection(a.key)}><Icon size={22}/>{a.label}<ChevronRight size={15}/></button>})}</div></div><div className="admin-panel"><h3><ShieldCheck size={18}/> Security checklist</h3><ul className="admin-checks"><li><CheckCircle2/> Admin role verified from database</li><li><CheckCircle2/> Row-level security policies required</li><li><CheckCircle2/> Public API keys only in browser</li><li><CheckCircle2/> Private person tracking disabled</li></ul></div></div></>}
      {section==="analytics"&&<div className="admin-stat-grid">{Object.entries(counts).map(([key,value])=><div className="admin-stat" key={key}><div><small>{key.replaceAll("_"," ")}</small><b>{value.toLocaleString()}</b></div><span><Activity size={21}/></span></div>)}</div>}
      {section==="system"&&<div className="admin-panel"><h3><Server size={18}/> Runtime information</h3><div className="admin-info-grid"><div><small>Framework</small><b>Next.js 15</b></div><div><small>Runtime</small><b>Node.js</b></div><div><small>Database</small><b>Supabase PostgreSQL</b></div><div><small>Authentication</small><b>Supabase Auth</b></div><div><small>Admin authorization</small><b>Database role + RLS</b></div><div><small>Environment</small><b>{process.env.NODE_ENV}</b></div></div><p className="admin-hint">This panel reports configured integrations only; it does not invent CPU, storage or uptime metrics that the hosting provider has not supplied.</p></div>}
      {section==="backup"&&<div className="admin-panel"><h3><Database size={18}/> Backup & Restore</h3><div className="admin-warning">Database backups are controlled by your Supabase project and plan. This page does not claim to create a backup from the browser.</div><ol className="admin-steps"><li>Open your Supabase project dashboard.</li><li>Use Database backups / Point-in-Time Recovery if enabled on your plan.</li><li>Before restoring, verify the target project and the backup timestamp.</li><li>After restore, run the app build and verify Auth, RLS and table access.</li></ol><a className="admin-primary-link" href="https://supabase.com/dashboard/projects" target="_blank" rel="noreferrer">Open Supabase dashboard <ArrowRight size={15}/></a></div>}
      {section==="about"&&<div className="admin-panel"><div className="admin-about-logo"><Shield size={42}/></div><h2>CyberX OSINT</h2><p>Public-source research workspace with an Android-first interface and database-protected administration.</p><div className="admin-warning">Safety scope: public technical metadata and public links only. No private-person tracking, account intrusion, password discovery, leaked personal-data search, or precise location claims.</div><a href="https://github.com/Xcyberking/CyberOsintIndia" target="_blank" rel="noreferrer">Repository <ArrowRight size={15}/></a></div>}
      {section==="settings"&&<section className="admin-panel" style={{marginBottom:18}}>
        <div className="admin-panel-head"><div><h3><CreditCard size={18}/> Payment Gateway & QR</h3><small>Razorpay credentials are stored encrypted in a private database table.</small></div><span className="admin-tag">{gatewayEnabled?"Gateway enabled":"Gateway disabled"}</span></div>
        <div className="admin-form-grid">
          <input value={gatewayKeyId} onChange={e=>setGatewayKeyId(e.target.value)} placeholder="Razorpay Key ID (rzp_test_… / rzp_live_…)"/>
          <input value={gatewayKeySecret} onChange={e=>setGatewayKeySecret(e.target.value)} type="password" autoComplete="new-password" placeholder="Razorpay Key Secret (leave blank to keep saved secret)"/>
        </div>
        <div className="admin-form-foot">
          <label><input type="checkbox" checked={gatewayEnabled} onChange={e=>setGatewayEnabled(e.target.checked)}/> Enable online payments</label>
          <button className="admin-primary" disabled={gatewaySaving||!gatewayKeyId.trim()} onClick={()=>void saveGateway()}>{gatewaySaving?"Saving…":"Save Gateway Settings"}</button>
        </div>
        <div style={{marginTop:14}}><label className="admin-form-label">Upload manual payment QR (PNG/JPG/WebP, max 2 MB)</label><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const file=e.target.files?.[0];if(file)void uploadPaymentQr(file);}}/><small className="admin-hint">QR is public and appears in the User Store. Gateway Secret is not shown again after saving.</small></div>
        {gatewayMessage&&<div className="admin-message" style={{marginTop:12}}>{gatewayMessage}</div>}
      </section>}
      {section==="credits"&&<section className="admin-panel" style={{marginBottom:18}}><div className="admin-panel-head"><div><h3><Coins size={18}/> Bulk credit manager</h3><small>Add or deduct credits for all users in one audited operation.</small></div></div><div className="admin-form-grid"><input type="number" step="1" value={bulkCreditDelta} onChange={e=>setBulkCreditDelta(e.target.value)} placeholder="Credits to add / deduct"/><input value={bulkCreditReason} onChange={e=>setBulkCreditReason(e.target.value)} placeholder="Reason shown in credit history"/></div><div className="admin-form-foot"><button className="admin-primary" disabled={bulkCreditBusy} onClick={()=>void bulkGrantCredits()}>{bulkCreditBusy?"Applying…":"Apply to all users"}</button></div></section>}
      {active.table&&<section className="admin-panel admin-data-panel"><div className="admin-panel-head"><div><h3>{active.label}</h3><small>{rows.length} records loaded · maximum 100 shown</small></div><div className="admin-data-actions"><div className="admin-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search records…"/></div><button onClick={()=>void loadRows()}><RefreshCw size={16}/></button></div></div>
        {addable&&<div className="admin-add-form"><h4><Plus size={16}/> {editingToolId?"Edit tool":"Add "+(section==="tools"?"tool":section==="plans"?"plan":section==="announcements"?"announcement":section==="api"?"integration":section==="developer"?"resource":"setting")}</h4><div className="admin-form-grid"><input placeholder={section==="settings"||section==="appearance"?"Setting key":"Name / title"} value={form.name||""} onChange={e=>setForm(v=>({...v,name:e.target.value}))}/>{section==="tools"&&<><input placeholder="Tool icon (e.g. Globe, Search, MapPin)" value={form.icon||"Wrench"} onChange={e=>setForm(v=>({...v,icon:e.target.value}))}/><input placeholder="API URL (use {} for query)" value={form.url||""} onChange={e=>setForm(v=>({...v,url:e.target.value}))}/><input placeholder="Category" value={form.category||""} onChange={e=>setForm(v=>({...v,category:e.target.value}))}/><input placeholder="Input label" value={form.input_label||"Enter query"} onChange={e=>setForm(v=>({...v,input_label:e.target.value}))}/><input type="number" min="0" placeholder="Credits per use" value={form.credit_cost||"1"} onChange={e=>setForm(v=>({...v,credit_cost:e.target.value}))}/></>}{section==="plans"&&<input placeholder="Price (INR)" value={form.price||""} onChange={e=>setForm(v=>({...v,price:e.target.value}))}/>}{section==="plans"&&<><input placeholder="Credits" value={form.credits||""} onChange={e=>setForm(v=>({...v,credits:e.target.value}))}/><input placeholder="Duration days" value={form.duration||"30"} onChange={e=>setForm(v=>({...v,duration:e.target.value}))}/></>}{(section==="api"||section==="developer")&&<input placeholder="Public URL" value={form.url||""} onChange={e=>setForm(v=>({...v,url:e.target.value}))}/>}{section==="developer"&&<input placeholder="Resource type" value={form.type||"documentation"} onChange={e=>setForm(v=>({...v,type:e.target.value}))}/>}{section==="settings"||section==="appearance"?<textarea placeholder='JSON value, e.g. {"theme":"blue"}' value={form.value||""} onChange={e=>setForm(v=>({...v,value:e.target.value}))}/>:<textarea placeholder="Description / body" value={form.description||""} onChange={e=>setForm(v=>({...v,description:e.target.value}))}/>}</div><div className="admin-form-foot"><label><input type="checkbox" checked={form.enabled==="true"} onChange={e=>setForm(v=>({...v,enabled:e.target.checked?"true":"false"}))}/>{section==="announcements"?"Publish now":section==="api"?"Enable integration":section==="tools"?"Enable tool":"Enabled"}</label><button className="admin-primary" disabled={saving||!form.name?.trim()} onClick={saveRecord}>{saving?"Saving…":editingToolId?"Update tool":"Save"}</button>{editingToolId&&<button className="admin-small" onClick={()=>{setEditingToolId("");setForm({});}}>Cancel edit</button>}</div></div>}
        {renderRows()}
      </section>}
    </main>
  </div>;
}
