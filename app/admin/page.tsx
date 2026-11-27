"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/firebase/compat";
type AuthUser = { id: string; email?: string | null; email_confirmed_at?: string | null; getIdTokenResult?: () => Promise<{claims:Record<string,unknown>}> };
import {
  Activity, ArrowDownToLine, ArrowLeft, ArrowRight, Bell, BookOpen, CheckCircle2,
  ChevronRight, CircleHelp, Code2, Coins, CreditCard, Database, FileClock,
  FileText, Gauge, Globe2, LayoutDashboard, LockKeyhole, LogOut, Megaphone,
  Palette, Plus, RefreshCw, Search, Settings, Shield, ShieldCheck, SlidersHorizontal,
  Sparkles, Ticket, Users, Wrench, X, Zap, Crown, Ban, Server, Link2, Github, Chrome, UserCircle, Save
} from "lucide-react";
import "./admin.css";

type Row = Record<string, unknown>;
type SectionKey = "dashboard"|"profile"|"users"|"banned"|"tools"|"plans"|"payments"|"credits"|"redeem"|"referrals"|"settings"|"appearance"|"announcements"|"api"|"backup"|"logs"|"developer"|"support"|"analytics"|"system"|"about";
type Section = { key: SectionKey; label: string; table?: string; description: string; icon: typeof Shield; };
const sections: Section[] = [
  {key:"dashboard",label:"Dashboard",description:"Overview of your OSINT workspace",icon:LayoutDashboard},
  {key:"profile",label:"My Profile",description:"View and edit your administrator profile",icon:UserCircle},
  {key:"users",label:"User Management",table:"profiles",description:"Review accounts, roles, status and credit balances",icon:Users},
  {key:"banned",label:"Banned Users",table:"profiles",description:"Review suspended and banned accounts",icon:Ban},
  {key:"tools",label:"Tools Management",table:"tools",description:"Enable, disable and organize public-source tools",icon:Wrench},
  {key:"plans",label:"Premium Plans",table:"premium_plans",description:"Manage plan names, prices, credits and duration",icon:Crown},
  {key:"payments",label:"Payments",table:"payment_records",description:"Review payment records and statuses",icon:CreditCard},
  {key:"credits",label:"Credits",table:"credit_transactions",description:"Audit credit grants and deductions",icon:Coins},
  {key:"redeem",label:"Redeem Codes",table:"redeem_codes",description:"Create credit codes and control redemption limits",icon:Ticket},
  {key:"referrals",label:"Referral System",table:"referral_claims",description:"Review referral qualification and rewards",icon:Users},
  {key:"settings",label:"Site Settings",table:"site_settings",description:"Store public site configuration",icon:Settings},
  {key:"announcements",label:"Announcements",table:"announcements",description:"Publish service notices and updates",icon:Megaphone},
  {key:"backup",label:"Backup & Restore",description:"Database backup guidance and restore checklist",icon:Database},
  {key:"support",label:"Support Center",table:"support_tickets",description:"Review user support requests",icon:Ticket},
  {key:"analytics",label:"Site Analytics",description:"Live counts from your configured database tables",icon:Activity},
  {key:"about",label:"About CyberX OSINT",description:"Project details and safety boundaries",icon:ShieldCheck}
];
const tableByKey: Partial<Record<SectionKey,string>> = {
  users:"profiles",banned:"profiles",tools:"tools",plans:"premium_plans",payments:"payment_records",
  credits:"profiles",redeem:"redeem_codes",referrals:"referral_claims",settings:"site_settings",
  announcements:"announcements",api:"api_integrations",logs:"admin_audit_logs",developer:"developer_resources",support:"support_tickets"
};
const backend=createClient();

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
  const [gatewayMessage,setGatewayMessage]=useState("");
  const [qrUploading,setQrUploading]=useState(false);
  const [paymentInstructionsDraft,setPaymentInstructionsDraft]=useState("");
  const [ticketReplies,setTicketReplies]=useState<Record<string,string>>({});
  const [bulkCreditDelta,setBulkCreditDelta]=useState("5");
  const [bulkCreditReason,setBulkCreditReason]=useState("Administrator bulk credit grant");
  const [bulkCreditBusy,setBulkCreditBusy]=useState(false);
  const [planEdits,setPlanEdits]=useState<Record<string,string>>({});
  const [adminPlans,setAdminPlans]=useState<{id:string;name:string;credits:number;duration_days:number}[]>([]);
  const [referralRewardForm,setReferralRewardForm]=useState({signup:"3",referred:"7",referrer:"3"});
  const [referralSettingsSaving,setReferralSettingsSaving]=useState(false);
  const [adminProfileDraft,setAdminProfileDraft]=useState({display_name:"",username:"",bio:""});
  const [adminProfileSaving,setAdminProfileSaving]=useState(false);
  const [redeemDraft,setRedeemDraft]=useState({code:"",credits:"25",maxUses:"10"});
  const [redeemSaving,setRedeemSaving]=useState(false);

  const verify=useCallback(async()=>{
    if(!backend){setChecking(false);return;}
    setChecking(true);
    const {data:{user},error:authError}=await backend.auth.getUser();
    if(authError){setAuthUser(null);setIsAdmin(false);setMessage(authError.message);setChecking(false);return;}
    setAuthUser(user);
    if(user){
      // First verify by immutable Auth user ID. If an older profile was created
      // before Auth identity linking, allow an exact verified-email match only
      // when that database profile is already explicitly admin + active.
      let profileQuery=await backend.from("profiles").select("id,email,role,status").eq("id",user.id).maybeSingle();
      if(!profileQuery.data && !profileQuery.error && user.email && user.email_confirmed_at){
        profileQuery=await backend.from("profiles").select("id,email,role,status").ilike("email",user.email).maybeSingle();
      }
      const profile=profileQuery.data;
      if(profileQuery.error){
        setIsAdmin(false);
        setMessage("Admin verification could not read your profile: "+profileQuery.error.message);
      } else {
        const verifiedEmailMatch=Boolean(user.email_confirmed_at && user.email &&
          profile?.email?.toLowerCase()===user.email.toLowerCase());
        const sameAuthUser=profile?.id===user.id;
        const tokenResult=await user.getIdTokenResult?.();
        const allowed=(sameAuthUser || verifiedEmailMatch) &&
          profile?.role==="admin" && profile?.status==="active" && tokenResult?.claims.admin===true;
        setIsAdmin(allowed);
        if(!allowed) setMessage("Signed in as "+(user.email||"an account")+", but this Auth identity is not linked to an active admin profile. Sign in with the email/password account or link its OAuth identity in Firebase.");
        else setMessage("");
      }
    } else setIsAdmin(false);
    setChecking(false);
  },[]);
  useEffect(()=>{
    void verify();
    if(!backend)return;
    const {data:{subscription}}=backend.auth.onAuthStateChange((_event:string,session:{user:any}|null)=>{
      if(!session){
        setAuthUser(null);setIsAdmin(false);setChecking(false);
        return;
      }
      // Defer Firebase API calls until after the auth event callback returns.
      window.setTimeout(()=>{void verify();},0);
    });
    return ()=>subscription.unsubscribe();
  },[verify]);

  const active=sections.find(s=>s.key===section)!;
  const loadRows=useCallback(async()=>{
    if(!backend||!isAdmin)return;
    const table=tableByKey[section];
    if(!table){setRows([]);return;}
    setLoading(true);
    let request=backend.from(table).select("*").order(table==="site_settings"?"updated_at":"created_at",{ascending:false}).limit(100);
    if(section==="banned") request=request.in("status",["banned","suspended"]);
    const {data,error}=await request;
    if(error)setMessage(error.message);
    else setRows((data||[]) as Row[]);
    setLoading(false);
  },[section,isAdmin]);
  useEffect(()=>{void loadRows();},[loadRows]);

  const loadCounts=useCallback(async()=>{
    if(!backend||!isAdmin)return;
    const tables=["profiles","tools","premium_plans","payment_records","support_tickets","referral_claims"];
    const results=await Promise.all(tables.map(async table=>{
      const {count}=await backend.from(table).select("*",{count:"exact",head:true});
      return [table,count||0] as const;
    }));
    setCounts(Object.fromEntries(results));
  },[isAdmin]);
  useEffect(()=>{void loadCounts();},[loadCounts]);
  useEffect(()=>{
    if(!backend||!isAdmin)return;
    void backend.from("premium_plans").select("id,name,credits,duration_days").order("name").then(({data}:{data:unknown[]|null})=>setAdminPlans((data||[]) as typeof adminPlans));
  },[isAdmin]);
  useEffect(()=>{
    if(!backend||!isAdmin)return;
    let active=true;
    void backend.from("site_settings").select("key,value").in("key",["default_signup_credits","referral_new_user_credits","referral_reward"]).then(({data,error}:{data:Array<{key:string;value:unknown}>|null;error:{message:string}|null})=>{
      if(!active)return;
      if(error){setMessage("Could not load referral rewards: "+error.message);return;}
      const map=Object.fromEntries((data||[]).map((row:{key:string;value:unknown})=>[row.key,row.value])) as Record<string,unknown>;
      const read=(key:string,fallback:number)=>{const raw=map[key] as {credits?:unknown}|undefined;const n=Number(raw?.credits??fallback);return Number.isSafeInteger(n)&&n>=0?n:fallback;};
      setReferralRewardForm({signup:String(read("default_signup_credits",3)),referred:String(read("referral_new_user_credits",7)),referrer:String(read("referral_reward",3))});
    });
    return ()=>{active=false;};
  },[isAdmin]);
  useEffect(()=>{
    if(!backend||!isAdmin||!authUser)return;
    let active=true;
    void backend.from("profiles").select("display_name,username,bio").eq("id",authUser.id).maybeSingle().then(({data,error}:{data:Record<string,unknown>|null;error:{message:string}|null})=>{
      if(!active)return;
      if(error){setMessage("Could not load admin profile: "+error.message);return;}
      setAdminProfileDraft({display_name:String(data?.display_name||""),username:String(data?.username||""),bio:String(data?.bio||"")});
    });
    return ()=>{active=false;};
  },[isAdmin,authUser?.id]);

  async function login(){
    if(!backend){setMessage("Firebase is not configured. Add the two NEXT_PUBLIC Firebase variables.");return;}
    setMessage("");
    const {error}=await backend.auth.signInWithPassword({email,password});
    if(error)setMessage(error.message);
    else await verify();
  }
  async function oauthLogin(provider:"google"|"github"){
    if(!backend){setMessage("Firebase is not configured.");return;}
    setMessage("");
    const redirectTo=window.location.origin+"/auth/callback?next=%2Fadmin";
    const {error}=await backend.auth.signInWithOAuth({
      provider,
      options:{
        redirectTo,
        scopes:provider==="github"?"read:user user:email":"openid email profile"
      }
    });
    if(error)setMessage(error.message);
  }
  async function logout(){if(backend)await backend.auth.signOut();setAuthUser(null);setIsAdmin(false);setMessage("");}
  async function saveAdminProfile(){
    if(!backend||!authUser)return;
    const display_name=adminProfileDraft.display_name.trim();
    const username=adminProfileDraft.username.trim();
    if(!display_name){setMessage("Enter your display name.");return;}
    if(username&&!/^[a-zA-Z0-9_]{3,24}$/.test(username)){setMessage("Username must be 3–24 letters, numbers or underscores.");return;}
    setAdminProfileSaving(true);
    const {error}=await backend.from("profiles").update({display_name,username:username||null,bio:adminProfileDraft.bio.trim(),updated_at:new Date().toISOString()}).eq("id",authUser.id);
    setMessage(error?error.message:"Administrator profile updated.");
    setAdminProfileSaving(false);
  }
  async function saveReferralSettings(){
    if(!backend||!authUser)return;
    const signup=Number(referralRewardForm.signup),referred=Number(referralRewardForm.referred),referrer=Number(referralRewardForm.referrer);
    if(![signup,referred,referrer].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=2147483647)){setMessage("Referral rewards must be whole numbers from 0 to 2,147,483,647.");return;}
    setReferralSettingsSaving(true);
    const updated_at=new Date().toISOString();
    const values=[
      {key:"default_signup_credits",value:{credits:signup},updated_by:authUser.id,updated_at},
      {key:"referral_new_user_credits",value:{credits:referred},updated_by:authUser.id,updated_at},
      {key:"referral_reward",value:{credits:referrer},updated_by:authUser.id,updated_at}
    ];
    const {error}=await backend.from("site_settings").upsert(values,{onConflict:"key"});
    setMessage(error?error.message:"Signup and referral rewards saved.");
    setReferralSettingsSaving(false);
  }

  async function createRedeemCode(){
    if(!backend)return;
    const code=redeemDraft.code.trim().toUpperCase();
    const credits=Number(redeemDraft.credits);
    const maxUses=Number(redeemDraft.maxUses);
    if(!/^[A-Z0-9-]{4,32}$/.test(code)){setMessage("Code must be 4–32 characters using A–Z, 0–9 or hyphens.");return;}
    if(!Number.isSafeInteger(credits)||credits<1||credits>1000000){setMessage("Credits must be a whole number from 1 to 1,000,000.");return;}
    if(!Number.isSafeInteger(maxUses)||maxUses<1||maxUses>100000){setMessage("Maximum users must be a whole number from 1 to 100,000.");return;}
    setRedeemSaving(true);setMessage("");
    const {error}=await backend.rpc("admin_create_redeem_code",{p_code:code,p_credits:credits,p_max_uses:maxUses});
    setMessage(error?error.message:"Redeem code created successfully.");
    if(!error){setRedeemDraft({code:"",credits:"25",maxUses:"10"});await loadRows();}
    setRedeemSaving(false);
  }
  async function deactivateRedeemCode(code:string){
    if(!backend||!window.confirm("Deactivate redeem code "+code+"? Existing redemptions will remain in history."))return;
    const {error}=await backend.rpc("admin_deactivate_redeem_code",{p_code:code});
    setMessage(error?error.message:"Redeem code deactivated.");
    if(!error)await loadRows();
  }

  async function saveRecord(){
    if(!backend||!active.table)return;
    setSaving(true);setMessage("");
    let payload:Row={};
    if(section==="tools") {
      const current=editingToolId?rows.find(row=>String(row.id)===editingToolId):undefined;
      const apiUrl=(form.url||"").trim();
      const queryPrice=Number(form.price_inr??0);
      if(!Number.isFinite(queryPrice)||queryPrice<0||queryPrice>100000||Math.abs(Math.round(queryPrice*100)-queryPrice*100)>0.000001){setMessage("Query price must be between ₹0 and ₹100,000 with up to 2 decimal places.");setSaving(false);return;}
      let handler=String(form.handler||current?.handler||"custom");
      const currentConfig=(current?.config&&typeof current.config==="object"?current.config:{}) as Record<string,unknown>;
      const config:Record<string,unknown>={...currentConfig,icon:form.icon||"Wrench"};
      if(apiUrl){
        if(!/^https:\/\//i.test(apiUrl) || (apiUrl.match(/\{\}/g)||[]).length!==1){setMessage("Tool API URL must use HTTPS and contain exactly one {} query placeholder.");setSaving(false);return;}
        try{const parsed=new URL(apiUrl.replace("{}", "sample"));if(parsed.protocol!=="https:")throw new Error();}catch{setMessage("Enter a valid HTTPS API URL.");setSaving(false);return;}
        handler="custom";
        config.api_url=apiUrl;
      } else if(!current || handler==="custom"){
        setMessage("A custom tool requires an HTTPS API URL with exactly one {} query placeholder.");setSaving(false);return;
      } else {
        delete config.api_url;
      }
      payload={slug:String(current?.slug||(form.name||"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")),name:form.name||"",description:form.description||"",category:form.category||"Research",handler,input_label:form.input_label||"Enter query",credit_cost:0,price_inr:queryPrice,enabled:form.enabled==="true",config};
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
    const {error}=await (section==="settings"||section==="appearance" ? backend.from(active.table).upsert(payload) : section==="tools"&&editingToolId ? backend.from("tools").update(payload).eq("id",editingToolId) : backend.from(active.table).insert(payload));
    if(error)setMessage(error.message);
    else {setForm({});setEditingToolId("");setMessage("Saved successfully.");await loadRows();await loadCounts();}
    setSaving(false);
  }

  async function updateUser(id:string){
    if(!backend)return;
    const edit=userEdits[id]||{role:"user",status:"active",delta:"0",reason:"Admin adjustment"};
    const {error}=await backend.rpc("admin_update_user",{target_user_id:id,new_role:edit.role,new_status:edit.status,credit_delta:Number(edit.delta||0),credit_reason:edit.reason||"Admin adjustment"});
    if(error)setMessage(error.message);
    else {setMessage("User account updated.");await loadRows();await loadCounts();}
  }
  async function clearUserCredits(row:Row){
    if(!backend)return;
    const id=String(row.id||"");
    const current=Number(row.credits||0);
    if(!id||!Number.isSafeInteger(current)||current<0){setMessage("Could not read this user's current credit balance.");return;}
    if(current===0){setMessage("This user already has 0 credits.");return;}
    const identity=String(row.email||row.username||id);
    if(!window.confirm("Clear all "+current+" credits for "+identity+"? This will be recorded in the credit history."))return;
    const {error}=await backend.rpc("admin_update_user",{
      target_user_id:id,new_role:null,new_status:null,credit_delta:-current,
      credit_reason:"Administrator cleared user credits"
    });
    setMessage(error?error.message:"All credits cleared for "+identity+".");
    if(!error){await loadRows();await loadCounts();}
  }
  async function updateStatus(id:string,status:string){
    if(!backend)return;
    const {error}=await backend.from("support_tickets").update({status,updated_at:new Date().toISOString()}).eq("id",id);
    setMessage(error?error.message:"Ticket updated.");if(!error)await loadRows();
  }
  async function replyToTicket(id:string){
    if(!backend)return;
    const reply=(ticketReplies[id]||"").trim();
    if(reply.length<2){setMessage("Write a reply before sending.");return;}
    const {error}=await backend.from("support_tickets").update({admin_reply:reply.slice(0,5000),status:"in_progress",updated_at:new Date().toISOString()}).eq("id",id);
    setMessage(error?error.message:"Reply sent to the user.");
    if(!error){setTicketReplies(v=>({...v,[id]:""}));await loadRows();}
  }
  async function bulkGrantCredits(){
    if(!backend)return;
    const delta=Number(bulkCreditDelta);
    if(!Number.isInteger(delta)||delta===0||Math.abs(delta)>100000){setMessage("Enter a whole-number credit amount between -100000 and 100000, excluding zero.");return;}
    if(!window.confirm((delta>0?"Add ":"Deduct ")+Math.abs(delta)+" credits for every user?"))return;
    setBulkCreditBusy(true);
    const {data,error}=await backend.rpc("admin_bulk_grant_credits",{p_credit_delta:delta,p_reason:bulkCreditReason.trim()||"Administrator bulk credit grant",p_target_user_id:null});
    setMessage(error?error.message:"Credits updated for "+String(data??0)+" users.");
    if(!error){await loadCounts();if(section==="users"||section==="credits")await loadRows();}
    setBulkCreditBusy(false);
  }
  async function assignPlanToUser(userId:string){
    if(!backend)return;
    const planId=planEdits[userId];
    if(!planId){setMessage("Choose a plan first.");return;}
    const {error}=await backend.rpc("admin_assign_plan",{p_target_user_id:userId,p_plan_id:planId,p_add_credits:true});
    setMessage(error?error.message:"Plan assigned and its credits added.");
    if(!error){setPlanEdits(v=>({...v,[userId]:""}));await loadRows();}
  }
  async function publishAnnouncement(id:string,published:boolean){
    if(!backend)return;
    const {error}=await backend.from("announcements").update({is_published:published,active:published}).eq("id",id);
    setMessage(error?error.message:"Announcement updated.");if(!error)await loadRows();
  }
  async function editTool(row:Row){setEditingToolId(String(row.id));const config=(row.config&&typeof row.config==="object"?row.config:{}) as Record<string,string>;setForm({name:valueText(row.name),description:valueText(row.description),category:valueText(row.category),url:config.api_url||"",icon:config.icon||"Wrench",handler:valueText(row.handler),credit_cost:valueText(row.credit_cost),price_inr:valueText(row.price_inr??0),input_label:valueText(row.input_label),enabled:String(Boolean(row.enabled))});setMessage("Editing "+valueText(row.name));}
  async function deleteTool(id:string){if(!backend||!window.confirm("Delete this tool permanently?"))return;const {error}=await backend.from("tools").delete().eq("id",id);setMessage(error?error.message:"Tool deleted.");if(!error){if(editingToolId===id){setEditingToolId("");setForm({});}await loadRows();await loadCounts();}}
  async function toggleTool(id:string,enabled:boolean){
    if(!backend)return;
    const {error}=await backend.from("tools").update({enabled}).eq("id",id);
    setMessage(error?error.message:"Tool status updated.");if(!error)await loadRows();
  }
  async function openPaymentProof(path:string){
    if(!backend||!path)return;
    const {data,error}=await backend.storage.from("cyberx-user-media").createSignedUrl(path,3600);
    if(error||!data?.signedUrl){setMessage(error?.message||"Could not open private payment proof.");return;}
    window.open(data.signedUrl,"_blank","noopener,noreferrer");
  }
  async function updateRow(table:string,id:string,patch:Row,success:string){
    if(!backend)return;
    const {error}=await backend.from(table).update(patch).eq("id",id);
    setMessage(error?error.message:success);if(!error)await loadRows();
  }


  async function saveManualPaymentSettings(){
    if(!backend)return;
    setGatewayMessage("");
    const values=[
      {key:"payment_instructions",value:paymentInstructionsDraft,updated_by:authUser?.id,updated_at:new Date().toISOString()}
    ];
    const {error}=await backend.from("site_settings").upsert(values,{onConflict:"key"});
    setGatewayMessage(error?error.message:"Manual payment instructions saved.");
  }

  async function uploadPaymentQr(file:File){
    if(!backend||!authUser||!isAdmin){setGatewayMessage("Verified administrator access is required to upload site images.");return;}
    if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>=2*1024*1024){setGatewayMessage("Choose a PNG, JPG or WebP image smaller than 2 MB.");return;}
    setQrUploading(true);setGatewayMessage("");
    const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"").slice(-80)||"payment-qr.png";
    const path="payment-qr/"+Date.now()+"-"+crypto.randomUUID()+"-"+safeName;
    const {error:uploadError}=await backend.storage.from("cyberx-site-media").upload(path,file,{upsert:true,contentType:file.type});
    if(uploadError){setGatewayMessage("Image upload failed: "+uploadError.message);setQrUploading(false);return;}
    const {data,error:urlError}=await backend.storage.from("cyberx-site-media").createSignedUrl(path,31536000);
    if(urlError||!data?.signedUrl){setGatewayMessage("Image uploaded, but its download URL could not be created: "+(urlError?.message||"Unknown storage error."));setQrUploading(false);return;}
    const {error:saveError}=await backend.from("site_settings").upsert({key:"payment_qr_url",value:data.signedUrl,updated_by:authUser.id,updated_at:new Date().toISOString()},{onConflict:"key"});
    if(saveError){setGatewayMessage("Image uploaded, but saving the site setting failed: "+saveError.message);setQrUploading(false);return;}
    setGatewayMessage("Payment QR image saved and published to the Store.");
    await loadRows();
    setQrUploading(false);
  }

  const filtered=useMemo(()=>rows.filter(row=>JSON.stringify(row).toLowerCase().includes(search.toLowerCase())),[rows,search]);
  useEffect(()=>{
    if(section!=="settings")return;
    const saved=rows.find(row=>row.key==="payment_instructions");
    if(saved)setPaymentInstructionsDraft(String(saved.value??"").replace(/^"|"$/g,""));
  },[section,rows]);
  const recordCount=Object.values(counts).reduce((a,b)=>a+b,0);
  const addable=["tools","plans","announcements","settings"].includes(section);

  if(checking)return <div className="admin-loading"><div className="admin-spinner"/>Checking admin access…</div>;
  if(!backend)return <div className="admin-auth"><div className="admin-auth-card"><div className="admin-logo"><Shield size={30}/></div><h1>Cyber<span>X</span> OSINT</h1><p>Admin panel configuration required</p><div className="admin-warning">Add NEXT_PUBLIC_FIREBASE_* settings in your hosting environment, then redeploy.</div><a href="https://github.com/Xcyberking/CyberOsintIndia" target="_blank" rel="noreferrer">Open project repository <ArrowRight size={15}/></a></div></div>;
  if(!authUser||!isAdmin)return <div className="admin-auth"><div className="admin-auth-card"><div className="admin-logo"><Shield size={30}/></div><h1>Cyber<span>X</span> OSINT</h1><p>{authUser?"This account does not have active admin access.":"Secure administrator sign in"}</p>{!authUser&&<><label>Email address</label><input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="admin@example.com"/><label>Password</label><input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Your password"/><button className="admin-primary" onClick={login}><LockKeyhole size={16}/> Admin Login</button><div className="admin-oauth-divider"><span>OR CONTINUE WITH</span></div><div className="admin-oauth-grid"><button type="button" onClick={()=>void oauthLogin("google")}><Chrome size={16}/> Google</button><button type="button" onClick={()=>void oauthLogin("github")}><Github size={16}/> GitHub</button></div></>}{message&&<div className="admin-message">{message}</div>}{authUser&&!isAdmin&&<button className="admin-primary" onClick={()=>void logout()}><LogOut size={16}/> Sign out / switch account</button>}<div className="admin-auth-note">OAuth login is real Firebase Auth. Only an account whose database profile has role=admin and status=active can enter this panel.</div></div></div>;

  const navGroups=[
    {title:"OVERVIEW",keys:["dashboard","analytics","system"] as SectionKey[]},
    {title:"ACCOUNT",keys:["profile"] as SectionKey[]},
    {title:"MANAGEMENT",keys:["users","banned","tools","plans","payments","credits","redeem","referrals"] as SectionKey[]},
    {title:"CONFIGURATION",keys:["settings","announcements","backup"] as SectionKey[]},
    {title:"OPERATIONS",keys:["support","about"] as SectionKey[]}
  ];
  const renderRows=()=>{
    if(loading)return <div className="admin-empty"><div className="admin-spinner"/>Loading records…</div>;
    if(!filtered.length)return <div className="admin-empty">No records found. Apply the database setup SQL and add your first records.</div>;
    if(section==="redeem")return <div className="admin-records">{filtered.map(row=><div className="admin-record" key={String(row.code||row.id)}><div className="admin-record-icon"><Ticket size={18}/></div><div className="admin-record-main"><strong className="mono">{valueText(row.code||row.id)}</strong><small>{valueText(row.credits)} credits · {valueText(row.used_count||0)} / {valueText(row.max_uses)} uses · {row.active===false?"Inactive":"Active"}</small><small>Created: {dateText(row.created_at)}</small></div>{row.active!==false&&<button className="admin-small" onClick={()=>void deactivateRedeemCode(String(row.code||row.id))}>Deactivate</button>}<span className="admin-tag">{row.active===false?"Inactive":"Active"}</span></div>)}</div>;
    if(section==="credits")return <div className="admin-table-wrap"><table><thead><tr><th>Email</th><th>Username</th><th>Current credits</th><th>Action</th></tr></thead><tbody>{filtered.map(row=><tr key={String(row.id)}><td>{valueText(row.email)}</td><td>{valueText(row.username||row.display_name||"—")}</td><td><strong>{valueText(row.credits)}</strong></td><td><button className="admin-small" disabled={Number(row.credits||0)===0} onClick={()=>void clearUserCredits(row)}>Clear credits</button></td></tr>)}</tbody></table></div>;
    if(section==="users"||section==="banned")return <div className="admin-table-wrap"><table><thead><tr><th>User ID</th><th>Email / Username</th><th>Role</th><th>Status</th><th>Credits</th><th>Credit / plan actions</th></tr></thead><tbody>{filtered.map(row=><tr key={String(row.id)}><td className="mono">{String(row.id).slice(0,8)}…</td><td>{valueText(row.email)}<small>{valueText(row.username||row.display_name||"—")}</small></td><td><select value={userEdits[String(row.id)]?.role||valueText(row.role)} onChange={e=>setUserEdits(v=>({...v,[String(row.id)]:{role:e.target.value,status:v[String(row.id)]?.status||valueText(row.status),delta:v[String(row.id)]?.delta||"0",reason:v[String(row.id)]?.reason||"Admin adjustment"}}))}><option value="user">User</option><option value="moderator">Moderator</option><option value="admin">Admin</option></select></td><td><select value={userEdits[String(row.id)]?.status||valueText(row.status)} onChange={e=>setUserEdits(v=>({...v,[String(row.id)]:{role:v[String(row.id)]?.role||valueText(row.role),status:e.target.value,delta:v[String(row.id)]?.delta||"0",reason:v[String(row.id)]?.reason||"Admin adjustment"}}))}><option value="active">Active</option><option value="suspended">Suspended</option><option value="banned">Banned</option></select></td><td>{valueText(row.credits)}</td><td><div className="admin-inline"><input aria-label="Credit adjustment" placeholder="+/- credits" value={userEdits[String(row.id)]?.delta||"0"} onChange={e=>setUserEdits(v=>({...v,[String(row.id)]:{role:v[String(row.id)]?.role||valueText(row.role),status:v[String(row.id)]?.status||valueText(row.status),delta:e.target.value,reason:v[String(row.id)]?.reason||"Admin adjustment"}}))}/><button className="admin-small" onClick={()=>updateUser(String(row.id))}>Save user</button><select value={planEdits[String(row.id)]||""} onChange={e=>setPlanEdits(v=>({...v,[String(row.id)]:e.target.value}))}><option value="">Assign plan…</option>{adminPlans.map(plan=><option key={plan.id} value={plan.id}>{plan.name} · {plan.credits} credits</option>)}</select><button className="admin-small" disabled={!planEdits[String(row.id)]} onClick={()=>void assignPlanToUser(String(row.id))}>Give plan</button></div></td></tr>)}</tbody></table></div>;
    if(section==="tools")return <div className="admin-records">{filtered.map(row=>{const cfg=(row.config&&typeof row.config==="object"?row.config:{}) as Record<string,string>;return <div className="admin-record" key={String(row.id)}><div className="admin-record-icon"><Wrench size={18}/></div><div className="admin-record-main"><strong>{valueText(row.name)}</strong><small>{valueText(row.description)} · ₹{Number(row.price_inr||0).toFixed(2)} per successful query</small><small className="mono">{cfg.api_url||"No API URL configured"}</small></div><label className="admin-switch"><input type="checkbox" checked={Boolean(row.enabled)} onChange={e=>toggleTool(String(row.id),e.target.checked)}/><span/></label><button className="admin-small" onClick={()=>void editTool(row)}>Edit</button><button className="admin-small" onClick={()=>void deleteTool(String(row.id))}>Delete</button></div>})}</div>;
    if(section==="announcements")return <div className="admin-records">{filtered.map(row=><div className="admin-record" key={String(row.id)}><div className="admin-record-icon"><Megaphone size={18}/></div><div className="admin-record-main"><strong>{valueText(row.title)}</strong><small>{valueText(row.body)}</small></div><button className="admin-small" onClick={()=>publishAnnouncement(String(row.id),!Boolean(row.is_published))}>{row.is_published?"Unpublish":"Publish"}</button></div>)}</div>;
    if(section==="plans")return <div className="admin-records">{filtered.map(row=><div className="admin-record" key={String(row.id)}><div className="admin-record-icon"><Crown size={18}/></div><div className="admin-record-main"><strong>{valueText(row.name)} · ₹{valueText(row.price_inr)}</strong><small>{valueText(row.credits)} credits · {valueText(row.duration_days)} days · {valueText(row.description)}</small></div><label className="admin-switch"><input type="checkbox" checked={Boolean(row.is_active)} onChange={e=>updateRow("premium_plans",String(row.id),{is_active:e.target.checked},"Plan status updated.")}/><span/></label></div>)}</div>;
    if(section==="payments")return <div className="admin-records">{filtered.map(row=><div className="admin-record" key={String(row.id)}><div className="admin-record-icon"><CreditCard size={18}/></div><div className="admin-record-main"><strong>₹{valueText(row.amount_inr)} · {valueText(row.provider)} · {valueText(row.status)}</strong><small>User: {String(row.user_id||"").slice(0,12)}… · Plan: {valueText(row.user_note||row.plan_id)}</small><small>UTR / reference: {valueText(row.provider_reference)} · {dateText(row.created_at)}</small>{Boolean(row.proof_url)&&<button className="admin-small" onClick={()=>void openPaymentProof(String(row.proof_url))}>Open private payment proof</button>}{Boolean(row.admin_note)&&<small>Admin note: {valueText(row.admin_note)}</small>}</div>{row.status==="pending"?<div className="admin-inline"><button className="admin-small" onClick={async()=>{if(!window.confirm("Confirm you checked the payment in the bank/UPI statement and received the money?"))return;const {error}=await backend!.rpc("admin_review_payment",{p_payment_id:String(row.id),p_approve:true,p_admin_note:null});setMessage(error?error.message:(row.payment_type==="wallet"?"Wallet deposit approved and balance updated.":"Payment approved; plan and credits applied."));if(!error){await loadRows();await loadCounts();}}}>Approve</button><button className="admin-small" onClick={async()=>{const note=window.prompt("Reason for rejection (optional):")||"";const {error}=await backend!.rpc("admin_review_payment",{p_payment_id:String(row.id),p_approve:false,p_admin_note:note});setMessage(error?error.message:"Payment rejected.");if(!error)await loadRows();}}>Reject</button></div>:<span className="admin-tag">{valueText(row.status)}</span>}</div>)}</div>;
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
      <header className="admin-topbar"><div><div className="admin-kicker">CYBERX OSINT / CONTROL CENTER</div><h1>{active.label}</h1></div><div className="admin-top-actions"><span className="admin-online"><i/> Admin access verified</span><a className="admin-small" href="/" style={{textDecoration:"none"}}>Open User App</a><button title="Refresh" onClick={()=>{void loadRows();void loadCounts();}}><RefreshCw size={17}/></button><button title="Notifications"><Bell size={17}/></button><button className="admin-top-avatar" title="My admin profile" onClick={()=>setSection("profile")}>{(adminProfileDraft.display_name||authUser.email||"CX").slice(0,2).toUpperCase()}</button></div></header>
      <div className="admin-subtitle">{active.description}</div>
      {message&&<div className="admin-message"><CheckCircle2 size={16}/>{message}<button onClick={()=>setMessage("")}><X size={15}/></button></div>}
      {section==="dashboard"&&<><section className="admin-welcome"><div><span>ADMINISTRATOR WORKSPACE</span><h2>Welcome back, CyberKing 👑</h2><p>Manage users, public-source tools, plans, credits and site operations from one place.</p></div><div className="admin-welcome-icon"><ShieldCheck size={48}/></div></section><div className="admin-stat-grid">{[{label:"Total users",value:counts.profiles||0,icon:Users},{label:"Available tools",value:counts.tools||0,icon:Wrench},{label:"Premium plans",value:counts.premium_plans||0,icon:Crown},{label:"Support tickets",value:counts.support_tickets||0,icon:Ticket},{label:"Payment records",value:counts.payment_records||0,icon:CreditCard},{label:"Referrals",value:counts.referral_claims||0,icon:Activity}].map(card=>{const Icon=card.icon;return <div className="admin-stat" key={card.label}><div><small>{card.label}</small><b>{card.value.toLocaleString()}</b></div><span><Icon size={21}/></span></div>})}</div><div className="admin-dashboard-grid"><div className="admin-panel"><h3><Zap size={18}/> Quick Actions</h3><div className="admin-quick-grid">{[{key:"users" as SectionKey,label:"Manage Users",icon:Users},{key:"tools" as SectionKey,label:"Manage Tools",icon:Wrench},{key:"plans" as SectionKey,label:"Premium Plans",icon:Crown},{key:"announcements" as SectionKey,label:"Announcement",icon:Megaphone},{key:"redeem" as SectionKey,label:"Redeem Codes",icon:Ticket},{key:"referrals" as SectionKey,label:"Referral Rewards",icon:Users}].map(a=>{const Icon=a.icon;return <button key={a.key} onClick={()=>setSection(a.key)}><Icon size={22}/>{a.label}<ChevronRight size={15}/></button>})}</div></div><div className="admin-panel"><h3><ShieldCheck size={18}/> Security checklist</h3><ul className="admin-checks"><li><CheckCircle2/> Admin role verified from database</li><li><CheckCircle2/> Row-level security policies required</li><li><CheckCircle2/> Public API keys only in browser</li><li><CheckCircle2/> Private person tracking disabled</li></ul></div></div></>}
      {section==="profile"&&<section className="admin-panel" style={{maxWidth:760}}><div className="admin-panel-head"><div><h3><UserCircle size={18}/> My Administrator Profile</h3><small>View and update the profile connected to your verified admin login.</small></div><span className="admin-tag">Admin</span></div><div className="admin-info-grid"><div><small>Login email</small><b>{authUser.email||"—"}</b></div><div><small>Account role</small><b>Administrator</b></div><div><small>Auth user ID</small><b className="mono">{authUser.id}</b></div></div><div className="admin-form-grid" style={{marginTop:18}}><input value={adminProfileDraft.display_name} onChange={e=>setAdminProfileDraft(v=>({...v,display_name:e.target.value}))} placeholder="Display name" maxLength={60}/><input value={adminProfileDraft.username} onChange={e=>setAdminProfileDraft(v=>({...v,username:e.target.value.replace(/[^a-zA-Z0-9_]/g,"").slice(0,24)}))} placeholder="Username (3–24 characters)" maxLength={24}/></div><textarea value={adminProfileDraft.bio} onChange={e=>setAdminProfileDraft(v=>({...v,bio:e.target.value}))} placeholder="Profile bio" rows={4} maxLength={240} style={{width:"100%",marginTop:12}}/><div className="admin-form-foot"><button className="admin-primary" disabled={adminProfileSaving} onClick={()=>void saveAdminProfile()}><Save size={15}/>{adminProfileSaving?"Saving…":"Save profile"}</button></div></section>}
      {section==="referrals"&&<section className="admin-panel" style={{marginBottom:18}}><div className="admin-panel-head"><div><h3><Users size={18}/> Referral Reward Settings</h3><small>Set signup and referral credits. Rewards are issued once after email confirmation.</small></div></div><div className="admin-form-grid"><label>Normal signup credits<input type="number" min="0" max="2147483647" step="1" value={referralRewardForm.signup} onChange={e=>setReferralRewardForm(v=>({...v,signup:e.target.value}))}/></label><label>Referred user's credits<input type="number" min="0" max="2147483647" step="1" value={referralRewardForm.referred} onChange={e=>setReferralRewardForm(v=>({...v,referred:e.target.value}))}/></label><label>Referrer reward credits<input type="number" min="0" max="2147483647" step="1" value={referralRewardForm.referrer} onChange={e=>setReferralRewardForm(v=>({...v,referrer:e.target.value}))}/></label></div><div className="admin-form-foot"><button className="admin-primary" disabled={referralSettingsSaving} onClick={()=>void saveReferralSettings()}>{referralSettingsSaving?"Saving…":"Save referral rewards"}</button></div><p className="admin-hint">New users without a referral link receive the normal signup amount. Users who register through a valid referral link receive the referred-user amount, and the owner of that link receives the referrer amount.</p></section>}
      {section==="analytics"&&<div className="admin-stat-grid">{Object.entries(counts).map(([key,value])=><div className="admin-stat" key={key}><div><small>{key.replaceAll("_"," ")}</small><b>{value.toLocaleString()}</b></div><span><Activity size={21}/></span></div>)}</div>}
      {section==="backup"&&<div className="admin-panel"><h3><Database size={18}/> Backup & Restore</h3><div className="admin-warning">Database backups are controlled by your Firebase project and plan. This page does not claim to create a backup from the browser.</div><ol className="admin-steps"><li>Open your Firebase project dashboard.</li><li>Use Database backups / Point-in-Time Recovery if enabled on your plan.</li><li>Before restoring, verify the target project and the backup timestamp.</li><li>After restore, run the app build and verify Auth, RLS and table access.</li></ol><a className="admin-primary-link" href="https://backend.com/dashboard/projects" target="_blank" rel="noreferrer">Open Firebase dashboard <ArrowRight size={15}/></a></div>}
      {section==="about"&&<div className="admin-panel"><div className="admin-about-logo"><Shield size={42}/></div><h2>CyberX OSINT</h2><p>Public-source research workspace with an Android-first interface and database-protected administration.</p><div className="admin-warning">Safety scope: public technical metadata and public links only. No private-person tracking, account intrusion, password discovery, leaked personal-data search, or precise location claims.</div><a href="https://github.com/Xcyberking/CyberOsintIndia" target="_blank" rel="noreferrer">Repository <ArrowRight size={15}/></a></div>}
      {section==="settings"&&<section className="admin-panel" style={{marginBottom:18}}>
        <div className="admin-panel-head"><div><h3><CreditCard size={18}/> Manual UPI / QR Payments</h3><small>Razorpay is not used. Admin approval is required for every wallet deposit.</small></div><span className="admin-tag">Manual verification</span></div>
        <div style={{marginTop:14}}><label className="admin-form-label">Upload payment QR (PNG/JPG/WebP, max 2 MB)</label><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const file=e.target.files?.[0];if(file)void uploadPaymentQr(file);}}/><small className="admin-hint">This QR is shown to users in the Wallet page. Use a payment account authorized to receive these payments.</small></div>
        <div style={{marginTop:14}}><label className="admin-form-label">Payment instructions shown to users</label><textarea rows={4} value={paymentInstructionsDraft} onChange={e=>setPaymentInstructionsDraft(e.target.value)} placeholder="Enter UPI name, payment instructions, and expected steps…"/></div>
        <div className="admin-form-foot"><button className="admin-primary" disabled={qrUploading} onClick={()=>void saveManualPaymentSettings()}>Save payment instructions</button></div>
        {gatewayMessage&&<div className="admin-message" style={{marginTop:12}}>{gatewayMessage}</div>}
      </section>}
      {section==="redeem"&&<section className="admin-panel" style={{marginBottom:18}}>
        <div className="admin-panel-head"><div><h3><Ticket size={18}/> Create custom redeem code</h3><small>Each account can redeem a code once. The code automatically closes when its user limit is reached.</small></div></div>
        <div className="admin-form-grid">
          <label>Redeem code<input value={redeemDraft.code} onChange={e=>setRedeemDraft(v=>({...v,code:e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,"").slice(0,32)}))} placeholder="e.g. CYBERX-100" maxLength={32}/></label>
          <label>Credits per user<input type="number" min="1" max="1000000" step="1" value={redeemDraft.credits} onChange={e=>setRedeemDraft(v=>({...v,credits:e.target.value}))}/></label>
          <label>Maximum users / redemptions<input type="number" min="1" max="100000" step="1" value={redeemDraft.maxUses} onChange={e=>setRedeemDraft(v=>({...v,maxUses:e.target.value}))}/></label>
        </div>
        <div className="admin-form-foot"><button className="admin-primary" disabled={redeemSaving} onClick={()=>void createRedeemCode()}>{redeemSaving?"Creating…":"Create redeem code"}</button></div>
      </section>}
      {section==="credits"&&<section className="admin-panel" style={{marginBottom:18}}><div className="admin-panel-head"><div><h3><Coins size={18}/> Bulk credit manager</h3><small>Add or deduct credits for all users in one audited operation.</small></div></div><div className="admin-form-grid"><input type="number" step="1" value={bulkCreditDelta} onChange={e=>setBulkCreditDelta(e.target.value)} placeholder="Credits to add / deduct"/><input value={bulkCreditReason} onChange={e=>setBulkCreditReason(e.target.value)} placeholder="Reason shown in credit history"/></div><div className="admin-form-foot"><button className="admin-primary" disabled={bulkCreditBusy} onClick={()=>void bulkGrantCredits()}>{bulkCreditBusy?"Applying…":"Apply to all users"}</button></div></section>}
      {active.table&&<section className="admin-panel admin-data-panel"><div className="admin-panel-head"><div><h3>{active.label}</h3><small>{rows.length} records loaded · maximum 100 shown</small></div><div className="admin-data-actions"><div className="admin-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search records…"/></div><button onClick={()=>void loadRows()}><RefreshCw size={16}/></button></div></div>
        {addable&&<div className="admin-add-form"><h4><Plus size={16}/> {editingToolId?"Edit tool":"Add "+(section==="tools"?"tool":section==="plans"?"plan":section==="announcements"?"announcement":section==="api"?"integration":section==="developer"?"resource":"setting")}</h4><div className="admin-form-grid"><input placeholder={section==="settings"||section==="appearance"?"Setting key":"Name / title"} value={form.name||""} onChange={e=>setForm(v=>({...v,name:e.target.value}))}/>{section==="tools"&&<><input placeholder="Tool icon (e.g. Globe, Search, MapPin)" value={form.icon||"Wrench"} onChange={e=>setForm(v=>({...v,icon:e.target.value}))}/><select value={form.handler||"custom"} onChange={e=>setForm(v=>({...v,handler:e.target.value}))}><option value="custom">Custom HTTPS API</option><option value="ip">Built-in IP lookup</option><option value="domain">Built-in domain lookup</option><option value="dns">Built-in DNS lookup</option><option value="email">Built-in email validation</option><option value="url">Built-in URL analysis</option><option value="username">Built-in username links</option><option value="social">Built-in social links</option><option value="breach">Built-in account self-check</option><option value="image">Built-in reverse image links</option></select><input placeholder="API URL (use {} for query; required for custom API)" value={form.url||""} onChange={e=>setForm(v=>({...v,url:e.target.value}))}/><input placeholder="Category" value={form.category||""} onChange={e=>setForm(v=>({...v,category:e.target.value}))}/><input placeholder="Input label" value={form.input_label||"Enter query"} onChange={e=>setForm(v=>({...v,input_label:e.target.value}))}/><input type="number" min="0" max="100000" step="0.01" placeholder="INR per successful query (e.g. 1.50)" value={form.price_inr??"0"} onChange={e=>setForm(v=>({...v,price_inr:e.target.value}))}/></>}{section==="plans"&&<input placeholder="Price (INR)" value={form.price||""} onChange={e=>setForm(v=>({...v,price:e.target.value}))}/>}{section==="plans"&&<><input placeholder="Credits" value={form.credits||""} onChange={e=>setForm(v=>({...v,credits:e.target.value}))}/><input placeholder="Duration days" value={form.duration||"30"} onChange={e=>setForm(v=>({...v,duration:e.target.value}))}/></>}{(section==="api"||section==="developer")&&<input placeholder="Public URL" value={form.url||""} onChange={e=>setForm(v=>({...v,url:e.target.value}))}/>}{section==="developer"&&<input placeholder="Resource type" value={form.type||"documentation"} onChange={e=>setForm(v=>({...v,type:e.target.value}))}/>}{section==="settings"||section==="appearance"?<textarea placeholder='JSON value, e.g. {"theme":"blue"}' value={form.value||""} onChange={e=>setForm(v=>({...v,value:e.target.value}))}/>:<textarea placeholder="Description / body" value={form.description||""} onChange={e=>setForm(v=>({...v,description:e.target.value}))}/>}</div><div className="admin-form-foot"><label><input type="checkbox" checked={form.enabled==="true"} onChange={e=>setForm(v=>({...v,enabled:e.target.checked?"true":"false"}))}/>{section==="announcements"?"Publish now":section==="api"?"Enable integration":section==="tools"?"Enable tool":"Enabled"}</label><button className="admin-primary" disabled={saving||!form.name?.trim()} onClick={saveRecord}>{saving?"Saving…":editingToolId?"Update tool":"Save"}</button>{editingToolId&&<button className="admin-small" onClick={()=>{setEditingToolId("");setForm({});}}>Cancel edit</button>}</div></div>}
        {renderRows()}
      </section>}
    </main>
  </div>;
}
