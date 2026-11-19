"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Activity, ArrowLeft, ArrowRight, Bell, CheckCircle2, ChevronRight, Clock3,
  Compass, Crown, Database, Globe2, History, Home, KeyRound, LayoutGrid,
  Link2, LockKeyhole, LogIn, LogOut, Mail, Menu, Moon, Search, Settings,
  Shield, ShieldCheck, Smartphone, Sparkles, User, UserRoundSearch, Users,
  Wifi, X, Zap, Image as ImageIcon, Share2, Network, Fingerprint, ExternalLink, Save, Edit3, Github, Chrome, Store, Gift, Coins, Camera, Copy, CalendarDays, Wrench
} from "lucide-react";

type ToolKey = string;
type ToolInfo = { key: ToolKey; title: string; description: string; icon: typeof Globe2; category: string };
const tools: ToolInfo[] = [
  { key: "username", title: "Username Tracker", description: "Build direct links to public profile pages; no private account scraping.", icon: UserRoundSearch, category: "Public profiles" },
  { key: "email", title: "Email Validator", description: "Validate email format and inspect its public mail domain.", icon: Mail, category: "Validation" },
  { key: "ip", title: "IP Lookup", description: "View approximate metadata for a public IP address.", icon: Wifi, category: "Network" },
  { key: "domain", title: "Domain Analyzer", description: "Review public RDAP registration and nameserver records.", icon: Globe2, category: "Web intelligence" },
  { key: "url", title: "Website Analyzer", description: "Inspect URL structure, HTTPS and hostname information.", icon: ShieldCheck, category: "Web intelligence" },
  { key: "dns", title: "DNS Lookup", description: "Query public A, AAAA, MX, NS and TXT DNS records.", icon: Network, category: "Network" },
  { key: "image", title: "Reverse Image Search", description: "Open public reverse-image search engines for an image URL.", icon: ImageIcon, category: "Media" },
  { key: "social", title: "Social Media Analyzer", description: "Open public profile links for a username across platforms.", icon: Share2, category: "Public profiles" },
  { key: "breach", title: "Breach Self-Check", description: "Open an official service to check your own email safely.", icon: Fingerprint, category: "Account safety" }
];
type HistoryItem = { title: string; query: string; date: string };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default function HomePage() {
  const [page, setPage] = useState("Splash");
  const [tool, setTool] = useState<ToolKey>("ip");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [announcements, setAnnouncements] = useState<{title:string;body:string;created_at:string}[]>([]);
  const [noticeLoading, setNoticeLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [enabledToolSlugs, setEnabledToolSlugs] = useState<string[]>(["username-tracker","email-validator","ip-lookup","domain-lookup","url-safety","dns-lookup","reverse-image-search","social-media-analyzer","breach-self-check"]);
  const [dbTools,setDbTools]=useState<{slug:string;name:string;description:string;category:string;enabled:boolean;handler:string;credit_cost:number;input_label:string;result_note:string;config?:Record<string,unknown>}[]>([]);
  const [username,setUsername]=useState(""); const [avatarUrl,setAvatarUrl]=useState("");
  const [credits,setCredits]=useState(0); const [planName,setPlanName]=useState("Free"); const [planExpires,setPlanExpires]=useState("");
  const [referralCode,setReferralCode]=useState(""); const [referralCount,setReferralCount]=useState(0); const [referralCredits,setReferralCredits]=useState(0);
  const [plans,setPlans]=useState<{id:string;name:string;description:string;price_inr:number;credits:number;duration_days:number}[]>([]);
  const [paymentQr,setPaymentQr]=useState(""); const [paymentInstructions,setPaymentInstructions]=useState("");
  const [selectedPlan,setSelectedPlan]=useState(""); const [paymentReference,setPaymentReference]=useState(""); const [paymentProof,setPaymentProof]=useState<File|null>(null);
  const [storeMessage,setStoreMessage]=useState(""); const [savingPayment,setSavingPayment]=useState(false); const [role,setRole]=useState("user");

  const toolSlug: Record<ToolKey,string> = { username:"username-tracker", email:"email-validator", ip:"ip-lookup", domain:"domain-lookup", url:"url-safety", dns:"dns-lookup", image:"reverse-image-search", social:"social-media-analyzer", breach:"breach-self-check" };
  const iconFor=(name:string)=>({Globe:Globe2,Globe2,Search,Compass:Compass,Mail,Wifi,Network,Shield:ShieldCheck,Image:ImageIcon,Users,User:UserRoundSearch,Database,Link:Link2,Wrench}[name]||Wrench);
  const visibleTools:ToolInfo[] = dbTools.length ? dbTools.filter(item=>item.enabled).map(item=>{
    const built=tools.find(t=>toolSlug[t.key]===item.slug);
    return built?{...built,title:item.name||built.title,description:item.description||built.description,category:item.category||built.category}
      :{key:item.slug,title:item.name,description:item.description,category:item.category,icon:iconFor(String(item.config?.icon||"Wrench"))};
  }):tools.filter(item=>enabledToolSlugs.includes(toolSlug[item.key]));
  const selectedTool = useMemo(() => visibleTools.find(item=>item.key===tool)||tools.find(item=>item.key===tool)||{key:tool,title:dbTools.find(x=>x.slug===tool)?.name||tool,description:dbTools.find(x=>x.slug===tool)?.description||"Custom administrator tool",icon:Wrench,category:"Custom"},[tool,visibleTools,dbTools]);

  async function hydrateUser(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }) {
    if (!supabase) return;
    const { data: profile } = await supabase.from("profiles").select("status,display_name,bio,username,avatar_url,credits,role,plan_name,plan_expires_at,referral_code").eq("id", user.id).maybeSingle();
    if (profile?.status && profile.status !== "active") {
      await supabase.auth.signOut();
      setUserEmail("");
      setAuthMessage("This account is currently suspended or restricted. Contact the site administrator.");
      return;
    }
    setUserEmail(user.email || "");
    setProfileName(profile?.display_name || (typeof user.user_metadata?.name === "string" ? user.user_metadata.name : user.email?.split("@")[0]) || "");
    setProfileBio(profile?.bio || ""); setUsername(profile?.username||""); if(profile?.avatar_url){const {data:av}=await supabase.storage.from("cyberx-avatars").createSignedUrl(profile.avatar_url,3600);setAvatarUrl(av?.signedUrl||"");}else setAvatarUrl(""); setCredits(profile?.credits||0); setRole(profile?.role||"user"); setPlanName(profile?.plan_name||"Free"); setPlanExpires(profile?.plan_expires_at||""); setReferralCode(profile?.referral_code||"");
    const { data } = await supabase.from("search_history").select("tool_slug,input_summary,created_at")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(30);
    if (data) setHistory(data.map((item) => ({
      title: tools.find((entry) => entry.key === item.tool_slug || toolSlug[entry.key]===item.tool_slug)?.title || dbTools.find(entry=>entry.slug===item.tool_slug)?.name || item.tool_slug,
      query: item.input_summary,
      date: new Date(item.created_at).toLocaleString()
    })));
    const [{data:claims},{data:transactions}]=await Promise.all([
      supabase.from("referral_claims").select("id,reward,status").eq("referrer_id",user.id),
      supabase.from("credit_transactions").select("delta").eq("user_id",user.id).ilike("reason","%Referral reward%")
    ]);
    setReferralCount(claims?.length||0); setReferralCredits((transactions||[]).reduce((sum,row)=>sum+(row.delta||0),0));
  }

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void Promise.all([
      supabase.from("tools").select("slug,name,description,category,enabled,handler,credit_cost,input_label,result_note,config"),
      supabase.from("premium_plans").select("id,name,description,price_inr,credits,duration_days").eq("is_active",true).order("price_inr"),
      supabase.from("site_settings").select("key,value").in("key",["payment_qr_url","payment_instructions"])
    ]).then(([t,p,s])=>{
      if(!active)return;
      if(t.data){setDbTools(t.data as typeof dbTools);setEnabledToolSlugs(t.data.filter(row=>row.enabled).map(row=>row.slug));}
      if(p.data)setPlans(p.data as typeof plans);
      const settings=Object.fromEntries((s.data||[]).map(row=>[row.key,row.value]));
      setPaymentQr(String(settings.payment_qr_url||"").replace(/^"|"$/g,""));
      setPaymentInstructions(String(settings.payment_instructions||"").replace(/^"|"$/g,""));
    });
    void supabase.auth.getSession().then(({ data }) => {
      if(!active)return;
      if(data.session?.user){void hydrateUser(data.session.user);setPage("Home");}
      else setPage("Login");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session) { setUserEmail(""); setProfileName(""); setProfileBio(""); setHistory([]); }
      else { setUserEmail(session.user.email || ""); Promise.resolve().then(() => void hydrateUser(session.user)); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const goTool = (key: ToolKey) => { setTool(key); setPage("Tool"); setQuery(""); setResult(null); setError(""); };
  const addHistory = async (title: string, value: string) => {
    setHistory((old) => [{ title, query: value, date: new Date().toLocaleString() }, ...old].slice(0, 30));
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.from("search_history").insert({
        user_id: user.id, tool_slug: tool, input_summary: value.slice(0, 500), status: "success"
      });
    }
  };

  async function runTool() {
    if(!userEmail){setError("Please login or register before using research tools.");setAuthMode("login");setPage("Login");return;}
    setBusy(true); setError(""); setResult(null);
    try {
      const configuredTool=dbTools.find(item=>item.slug===tool);
      const configuredApi=String(configuredTool?.config?.api_url||"").trim();
      let data: unknown;
      // Admin-configured API tools take priority over the built-in tool registry.
      if(configuredTool && configuredApi){
        if(!configuredApi.startsWith("https://")||(configuredApi.match(/\{\}/g)||[]).length!==1)throw new Error("This tool has an invalid API URL. Admin must use HTTPS and exactly one {} placeholder.");
        const target=configuredApi.replace("{}",encodeURIComponent(query.trim()));
        const response=await fetch(target,{method:"GET",headers:{Accept:"application/json"}});
        const raw=await response.text();
        let parsed:unknown;
        try{parsed=JSON.parse(raw);}catch{parsed={response:raw};}
        if(!response.ok)throw new Error("Configured API returned HTTP "+response.status+". "+(typeof parsed==="object"&&parsed!==null&&"error" in parsed?String((parsed as {error:unknown}).error):"Request failed"));
        data=parsed;
      } else if (tool === "ip") {
        const response = await fetch("/api/ip?address=" + encodeURIComponent(query.trim()));
        data = await response.json();
        if (!response.ok) throw new Error((data as { error?: string }).error || "Lookup failed.");
      } else if (tool === "domain") {
        const response = await fetch("/api/domain?domain=" + encodeURIComponent(query.trim()));
        data = await response.json();
        if (!response.ok) throw new Error((data as { error?: string }).error || "Lookup failed.");
      } else if (tool === "dns") {
        const host = query.trim().toLowerCase().replace("https://", "").replace("http://", "").split("/")[0];
        const response = await fetch("/api/dns?domain=" + encodeURIComponent(host));
        data = await response.json();
        if (!response.ok) throw new Error((data as {error?:string}).error || "DNS lookup failed.");
      } else if (!tools.some(t=>t.key===tool)) {
        const custom=dbTools.find(t=>t.slug===tool);
        const handler=custom?.handler||"custom";
        if(handler==="email"){
          const parts=query.trim().split("@");
          if(parts.length!==2||!parts[0]||!parts[1].includes("."))throw new Error("Enter a valid email address.");
          data={email:query.trim(),note:"Syntax validation only; mailbox ownership is not verified."};
        } else if(handler==="url"){
          const parsed=new URL(query.trim().startsWith("http")?query.trim():"https://"+query.trim());
          if(parsed.protocol!=="https:"&&parsed.protocol!=="http:")throw new Error("Only HTTP and HTTPS are supported.");
          data={url:parsed.href,protocol:parsed.protocol,hostname:parsed.hostname};
        } else if(handler==="username"||handler==="social"){
          const handle=query.trim().replace(/^@/,"");
          if(handle.length<2||handle.length>30||!/^[a-zA-Z0-9._-]+$/.test(handle))throw new Error("Enter a public username.");
          data={username:handle,note:"Public links only; no scraping or identity claims."};
        } else if(handler==="breach"){
          data={service:"Have I Been Pwned",link:"https://haveibeenpwned.com/",note:"Use the official service to check your own email."};
        } else if(handler==="image"){
          const imageUrl=new URL(query.trim());
          if(imageUrl.protocol!=="https:"&&imageUrl.protocol!=="http:")throw new Error("Enter a public image URL.");
          data={imageUrl:imageUrl.href,search:"https://lens.google.com/uploadbyurl?url="+encodeURIComponent(imageUrl.href)};
        } else {
          throw new Error("This tool has no API URL. Ask the administrator to edit the tool and add its HTTPS API URL with one {} query placeholder.");
        }
      } else if (tool === "image") {
        const imageUrl = new URL(query.trim());
        if (!["http:", "https:"].includes(imageUrl.protocol)) throw new Error("Enter a public HTTP or HTTPS image URL.");
        data = { imageUrl: imageUrl.href, publicSearchLinks: [
          ["Google Lens", "https://lens.google.com/uploadbyurl?url=" + encodeURIComponent(imageUrl.href)],
          ["Bing Visual Search", "https://www.bing.com/images/searchbyimage?cbir=sbi&imgurl=" + encodeURIComponent(imageUrl.href)],
          ["TinEye", "https://tineye.com/search?url=" + encodeURIComponent(imageUrl.href)]
        ], note: "The image URL is shared with the search provider only when you open its link. Use images you own or have permission to search." };
      } else if (tool === "social") {
        const handle = query.trim().replace(/^@/, "");
        if (!/^[a-zA-Z0-9._-]{2,30}$/.test(handle)) throw new Error("Enter a public username (2–30 letters, numbers, dots, underscores or hyphens).");
        data = { username: handle, publicLinks: [
          ["Instagram", "https://www.instagram.com/" + encodeURIComponent(handle) + "/"],
          ["Facebook", "https://www.facebook.com/" + encodeURIComponent(handle)],
          ["X", "https://x.com/" + encodeURIComponent(handle)],
          ["TikTok", "https://www.tiktok.com/@" + encodeURIComponent(handle)],
          ["YouTube", "https://www.youtube.com/@" + encodeURIComponent(handle)],
          ["LinkedIn", "https://www.linkedin.com/in/" + encodeURIComponent(handle) + "/"]
        ], note: "These are links only. The app does not scrape profiles or confirm identity." };
      } else if (tool === "breach") {
        const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(query.trim());
        if (!valid) throw new Error("Enter your own email address in a valid format.");
        data = { service: "Have I Been Pwned", email: query.trim(), links: [["Open official self-check", "https://haveibeenpwned.com/"]], note: "For privacy, this app does not submit your email or retrieve breach records. Open the official service yourself." };
      } else if (tool === "email") {
        const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(query.trim());
        const domain = query.trim().split("@")[1] || "";
        if (!valid) throw new Error("Enter an email address in a valid format.");
        const response = await fetch("/api/dns?domain=" + encodeURIComponent(domain));
        const dnsData = await response.json();
        if (!response.ok) throw new Error((dnsData as {error?:string}).error || "Mail domain lookup failed.");
        const mx = (dnsData as {records?:{type:string;records:{value:string}[]}[]}).records?.find(record => record.type === "MX")?.records || [];
        data = { email: query.trim(), syntax: "Valid format", domain, mailDomainRecords: mx, note: "MX records indicate mail routing only; they do not identify the owner or verify mailbox access." };
      } else if (tool === "url") {
        const parsed = new URL(query.match(/^https?:\/\//) ? query : "https://" + query);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Only HTTP and HTTPS website URLs are supported.");
        const dnsResponse = await fetch("/api/dns?domain=" + encodeURIComponent(parsed.hostname));
        const dnsData = await dnsResponse.json();
        data = { url: parsed.href, protocol: parsed.protocol.replace(":", "").toUpperCase(), hostname: parsed.hostname, port: parsed.port || "Default", secureTransport: parsed.protocol === "https:" ? "HTTPS enabled" : "HTTP only", dns: dnsResponse.ok ? dnsData : (dnsData as {error?:string}).error, note: "This checks URL structure and public DNS only; it is not a malware or reputation verdict." };
      } else {
        const handle = query.trim().replace(/^@/, "");
        if (!/^[a-zA-Z0-9._-]{2,30}$/.test(handle)) throw new Error("Enter a public username (2–30 letters, numbers, dots, underscores or hyphens).");
        data = {
          username: handle,
          publicLinks: [
            ["GitHub", "https://github.com/" + encodeURIComponent(handle)],
            ["Instagram", "https://www.instagram.com/" + encodeURIComponent(handle) + "/"],
            ["X", "https://x.com/" + encodeURIComponent(handle)],
            ["TikTok", "https://www.tiktok.com/@" + encodeURIComponent(handle)],
            ["Reddit", "https://www.reddit.com/user/" + encodeURIComponent(handle) + "/"]
          ],
          note: "These are direct public profile links. No accounts are scraped and no match is claimed."
        };
      }
      if(supabase){const {data:{user}}=await supabase.auth.getUser();if(user){const slug=toolSlug[tool]||tool;const {data:remaining,error:creditError}=await supabase.rpc("consume_tool_credit",{p_tool_slug:slug,p_query:query.trim()});if(creditError)throw new Error(creditError.message);if(typeof remaining==="number")setCredits(remaining);}}
      setResult(data); await addHistory(selectedTool.title, query.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally { setBusy(false); }
  }

  async function authenticate() {
    setAuthMessage("");
    if (authMode === "register" && password.length < 8) { setAuthMessage("Use a password with at least 8 characters."); return; }
    if (authMode === "register" && password !== confirmPassword) { setAuthMessage("Passwords do not match."); return; }
    if (!supabase) { setAuthMessage("Supabase is not configured. Check the public Supabase URL and publishable key in hosting settings."); return; }
    const response = authMode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { name: displayName, referral_code: new URLSearchParams(window.location.search).get("ref") || "" } } });
    if (response.error) setAuthMessage(response.error.message);
    else if (authMode === "register" && !response.data.session) setAuthMessage("Account created. Check your email to confirm your address.");
    else if (response.data.user && response.data.session) {
      await hydrateUser(response.data.user);
      setPage("Home");
    } else { setAuthMessage("Account created. Check your email to confirm your address."); }
  }
  async function openNotifications() {
    setPage("Notifications"); setNoticeLoading(true);
    if (supabase) {
      const { data } = await supabase.from("announcements").select("title,body,created_at").eq("active",true).order("created_at",{ascending:false}).limit(30);
      setAnnouncements(data || []);
    }
    setNoticeLoading(false);
  }

  async function saveProfile() {
    if (!supabase) return;
    setProfileSaving(true); setProfileMessage("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setProfileMessage("Please sign in again."); setProfileSaving(false); return; }
    const { error } = await supabase.from("profiles").update({
      display_name: profileName.trim(), username: username.trim()||null, bio: profileBio.trim(), updated_at: new Date().toISOString()
    }).eq("id", user.id);
    setProfileMessage(error ? error.message : "Profile updated successfully."); if(!error)await hydrateUser(user);
    setProfileSaving(false);
  }

  async function uploadAvatar(file:File){
    if(!supabase)return; const {data:{user}}=await supabase.auth.getUser(); if(!user)return;
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>5*1024*1024){setProfileMessage("Choose a JPG, PNG or WebP image under 5 MB.");return;}
    const path=user.id+"/avatar-"+Date.now()+"."+file.name.split(".").pop();
    const {error}=await supabase.storage.from("cyberx-avatars").upload(path,file,{upsert:true,contentType:file.type});
    if(error){setProfileMessage(error.message);return;}
    const {data}=await supabase.storage.from("cyberx-avatars").createSignedUrl(path,3600);
    if(data?.signedUrl){const {error:e}=await supabase.from("profiles").update({avatar_url:path,updated_at:new Date().toISOString()}).eq("id",user.id);setProfileMessage(e?e.message:"Profile photo updated.");if(!e)setAvatarUrl(data.signedUrl);}
  }
  async function submitPayment(){
    if(!supabase||!selectedPlan){setStoreMessage("Choose a plan first.");return;}
    setSavingPayment(true);setStoreMessage("");const {data:{user}}=await supabase.auth.getUser();const plan=plans.find(p=>p.id===selectedPlan);
    if(!user||!plan){setStoreMessage("Please sign in and select a valid plan.");setSavingPayment(false);return;}
    let proofUrl="";
    if(paymentProof){const path=user.id+"/payment-"+Date.now()+"."+paymentProof.name.split(".").pop();const {error:e}=await supabase.storage.from("cyberx-user-media").upload(path,paymentProof,{contentType:paymentProof.type});if(e){setStoreMessage(e.message);setSavingPayment(false);return;}const {data}=await supabase.storage.from("cyberx-user-media").createSignedUrl(path,2592000);proofUrl=data?.signedUrl||"";}
    const {error}=await supabase.from("payment_records").insert({user_id:user.id,plan_id:plan.id,provider:"manual_qr",provider_reference:paymentReference.trim(),amount_inr:plan.price_inr,status:"pending",proof_url:proofUrl,user_note:"Plan: "+plan.name});
    setStoreMessage(error?error.message:"Payment submitted. Credits activate only after admin verification.");setSavingPayment(false);
  }

  async function clearHistory() {
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase.from("search_history").delete().eq("user_id", user.id);
        if (error) { setError("Could not clear saved history: " + error.message); return; }
      }
    }
    setHistory([]);
  }

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    setUserEmail(""); setProfileName(""); setProfileBio(""); setHistory([]); setPage("Home");
  }

  const nav = [
    { label: "Home", icon: Home }, { label: "All Tools", icon: LayoutGrid }, { label: "Store", icon: Store },
    { label: "History", icon: History }, { label: "Profile", icon: User },
    { label: "Settings", icon: Settings }
  ];
  const navTo = (label: string) => { setPage(label); setMobileMenu(false); };
  const PageIcon = selectedTool.icon;

  if (page === "Login" || page === "Register") {
    return <div className="auth-wrap"><div className="auth-card">
      <div className="auth-logo"><div className="brand-mark"><Shield size={25}/></div></div>
      <h1>Cyber<span style={{color:"#0872f9"}}>X</span> OSINT</h1>
      <p>{authMode === "login" ? "Sign in to your research workspace" : "Create your secure account"}</p>
      {authMode === "register" && <><label className="field-label">Display name</label><input className="field" placeholder="Your name" value={displayName} onChange={(e)=>setDisplayName(e.target.value)}/></>}
      <label className="field-label">Email address</label><input className="field" type="email" placeholder="you@example.com" value={email} onChange={(e)=>setEmail(e.target.value)}/>
      <label className="field-label">Password</label><input className="field" type="password" placeholder="Enter password" value={password} onChange={(e)=>setPassword(e.target.value)}/>
      {authMode === "register" && <><label className="field-label">Confirm password</label><input className="field" type="password" placeholder="Confirm password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></>}
      {authMode === "login" && <button className="text-link" style={{marginTop:10}} onClick={async()=>{if(!supabase||!email.trim()){setAuthMessage("Enter your email address first.");return;}const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin});setAuthMessage(error?error.message:"Password reset email sent if the account exists.");}}>Forgot password?</button>}
      <button className="primary-btn" style={{width:"100%",marginTop:20}} onClick={authenticate}>{authMode === "login" ? "Login" : "Create account"} <ArrowRight size={15} style={{verticalAlign:"middle",marginLeft:5}}/></button>
      {authMessage && <p className="error">{authMessage}</p>}
      <div className="auth-switch">{authMode === "login" ? "Don't have an account?" : "Already registered?"} <button onClick={()=>{setAuthMode(authMode==="login"?"register":"login");setAuthMessage("");setConfirmPassword("");}}>{authMode==="login"?"Register":"Login"}</button></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginTop:16}}>
        <button className="secondary-btn" onClick={async()=>{if(!supabase){setAuthMessage("Supabase is not configured.");return;}const {error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:window.location.origin+"/auth/callback?next=%2F",scopes:"openid email profile"}});if(error)setAuthMessage(error.message);}}><Chrome size={15} style={{verticalAlign:"middle",marginRight:6}}/>Google</button>
        <button className="secondary-btn" onClick={async()=>{if(!supabase){setAuthMessage("Supabase is not configured.");return;}const {error}=await supabase.auth.signInWithOAuth({provider:"github",options:{redirectTo:window.location.origin+"/auth/callback?next=%2F",scopes:"read:user user:email"}});if(error)setAuthMessage(error.message);}}><Github size={15} style={{verticalAlign:"middle",marginRight:6}}/>GitHub</button>
      </div>
      <div className="notice">Google and GitHub buttons require their providers to be enabled in Supabase Auth. Never share your password or verification codes.</div>
      <button className="secondary-btn" style={{width:"100%",marginTop:14}} onClick={()=>setPage("Home")}>Back to home</button>
    </div></div>;
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Shield size={24}/></div><div><div className="brand-name">Cyber<span>X</span> OSINT</div><div className="brand-sub">INTELLIGENCE WORKSPACE</div></div></div>
      <div className="nav-label">WORKSPACE</div>
      <div className="nav-list">{nav.map(({label,icon:Icon})=><button key={label} className={"nav-item "+(page===label?"active":"")} onClick={()=>navTo(label)}><Icon size={17}/>{label}</button>)}</div>
      <div className="nav-label" style={{marginTop:20}}>ACCOUNT</div>
      <button className="nav-item" onClick={()=>navTo("Settings")}><LockKeyhole size={17}/>Privacy & Security</button>
      <div className="sidebar-bottom"><div style={{display:"flex",alignItems:"center",gap:8}}><Sparkles size={16} color="#28caff"/><strong>Research responsibly</strong></div><p>Use public information lawfully. Respect privacy and website terms.</p></div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div>
          <div className="mobile-header"><div className="brand-mark" style={{width:34,height:34,borderRadius:11}}><Shield size={19}/></div><div className="mobile-brand">Cyber<span>X</span> OSINT</div></div>
          <div className="eyebrow">CYBERX INTELLIGENCE / {page.toUpperCase()}</div>
          <h1 className="page-title">{page === "Tool" ? selectedTool.title : page === "Home" ? "Dashboard" : page}</h1>
        </div>
        <div className="top-actions"><button className="icon-btn" aria-label="Notifications" title="Notifications" onClick={()=>void openNotifications()}><Bell size={17}/></button>{userEmail ? <>{role==="admin"&&<button className="secondary-btn" onClick={()=>{window.location.href="/admin";}}>Admin Panel</button>}<button className="secondary-btn" onClick={()=>navTo("Profile")}><Edit3 size={14} style={{verticalAlign:"middle",marginRight:5}}/>Profile Edit</button><div className="avatar">{userEmail[0].toUpperCase()}</div></> : <><button className="secondary-btn" onClick={()=>{setAuthMode("login");setPage("Login");}}>Login</button><button className="primary-btn" onClick={()=>{setAuthMode("register");setPage("Register");}}>Register</button></>}</div>
      </header>

      {page === "Splash" && <div className="auth-wrap"><div className="auth-card" style={{textAlign:"center"}}><div className="auth-logo"><div className="brand-mark"><Shield size={34}/></div></div><h1>Cyber<span style={{color:"#0872f9"}}>X</span> OSINT</h1><p>Explore · Analyze · Investigate</p><div className="auth-spinner" aria-label="Loading"/></div></div>}
      {page === "Home" && <>
        <section className="welcome"><div><div className="eyebrow" style={{color:"#a8d9ff"}}>YOUR PUBLIC-SOURCE RESEARCH HUB</div><h2>Welcome back, {userEmail ? userEmail.split("@")[0] : "CyberKing"} 👋</h2><p>Explore public technical information with a clean, privacy-conscious workspace. Keep your research organized and transparent.</p></div><div className="welcome-tag"><Activity size={13} style={{verticalAlign:"middle",marginRight:6}}/> SYSTEM READY</div></section>
        <section className="stats">
          <div className="stat-card"><div className="stat-icon"><LayoutGrid size={20}/></div><div><div className="stat-label">AVAILABLE TOOLS</div><div className="stat-value">{visibleTools.length.toString().padStart(2,"0")}</div></div></div>
          <div className="stat-card"><div className="stat-icon"><History size={20}/></div><div><div className="stat-label">YOUR SEARCHES</div><div className="stat-value">{history.length.toString().padStart(2,"0")}</div></div></div>
          <div className="stat-card"><div className="stat-icon"><ShieldCheck size={20}/></div><div><div className="stat-label">PRIVACY MODE</div><div className="stat-value" style={{fontSize:17}}>Enabled</div></div></div><div className="stat-card"><div className="stat-icon"><Coins size={20}/></div><div><div className="stat-label">YOUR CREDITS</div><div className="stat-value">{credits}</div><small>{planName} plan</small></div></div>
        </section>
        <div className="section-head"><h3>Quick Tools</h3><button className="text-link" onClick={()=>navTo("All Tools")}>View all <ArrowRight size={14} style={{verticalAlign:"middle"}}/></button></div>
        <div className="tool-grid">{visibleTools.slice(0,6).map((item)=>{const Icon=item.icon;return <button className="tool-card" key={item.key} onClick={()=>goTool(item.key)}><div className="tool-icon"><Icon size={21}/></div><strong>{item.title}</strong><small>{item.description}</small></button>})}</div>
        <section className="premium"><div><h3><Crown size={17} style={{verticalAlign:"middle",marginRight:6,color:"#ffd66b"}}/> CyberX Research Suite</h3><p>Organize public-source checks in one mobile-friendly place.</p></div><button className="primary-btn" onClick={()=>navTo("Store")}>Open Store</button></section>
        <div className="section-head"><h3>Recent activity</h3><button className="text-link" onClick={()=>navTo("History")}>History <ArrowRight size={14} style={{verticalAlign:"middle"}}/></button></div>
        {history.length ? <div className="tool-list">{history.slice(0,3).map((item,i)=><div className="tool-row" key={i}><div className="tool-icon"><Clock3 size={18}/></div><span><strong>{item.title}</strong><small>{item.query} · {item.date}</small></span><ChevronRight size={17}/></div>)}</div> : <div className="panel empty">Your recent research will appear here after your first lookup.</div>}
      </>}

      {page === "All Tools" && <>
        <div className="content-panel" style={{maxWidth:"none",marginBottom:16}}><div style={{display:"flex",alignItems:"center",gap:10}}><Search color="#0872f9"/><div><strong style={{fontSize:14}}>Find a research tool</strong><div className="notice" style={{margin:0}}>Choose a public-source utility below.</div></div></div></div>
        <div className="tool-list">{visibleTools.map((item)=>{const Icon=item.icon;return <button className="tool-row" key={item.key} onClick={()=>goTool(item.key)}><div className="tool-icon"><Icon size={20}/></div><span><strong>{item.title}</strong><small>{item.description}</small></span><ChevronRight size={18}/></button>})}</div>
        <div className="notice">Only tools enabled by the administrator are shown. CyberX does not offer private-person tracking, account intrusion, password discovery, or leaked personal-data searches.</div>
      </>}

      {page === "Tool" && <div className="content-panel">
        <div className="page-topline"><button className="back-btn" onClick={()=>navTo("All Tools")}><ArrowLeft size={19}/></button><div><strong>{selectedTool.title}</strong><div className="notice" style={{margin:0}}>{selectedTool.description}</div></div></div>
        <div className="tool-icon" style={{width:58,height:58,marginTop:22}}><PageIcon size={28}/></div>
        <label className="field-label">{dbTools.find(item=>item.slug===tool)?.input_label || (tool==="ip"?"Enter public IP address":tool==="domain"||tool==="dns"?"Enter domain name":tool==="email"||tool==="breach"?"Enter email address":tool==="username"||tool==="social"?"Enter public username":tool==="image"?"Enter public image URL":"Enter website URL")}</label>
        <div className="form-row"><input className="field" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder={tool==="ip"?"8.8.8.8":tool==="domain"||tool==="dns"?"example.com":tool==="email"||tool==="breach"?"name@example.com":tool==="username"||tool==="social"?"public_username": "https://example.com/image.jpg"} onKeyDown={(e)=>{if(e.key==="Enter")runTool();}}/><button className="primary-btn" disabled={busy||!query.trim()} onClick={runTool}>{busy?"Checking…":tool==="ip"||tool==="dns"?"Lookup":tool==="domain"||tool==="url"?"Analyze":"Check"} <ArrowRight size={15} style={{verticalAlign:"middle"}}/></button></div>
        {error && <div className="error">{error}</div>}
        {result !== null && (
          <div className="result-box">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,color:"#0872f9",fontWeight:800,marginBottom:10}}>
              <span><CheckCircle2 size={17}/> API Response</span>
              <button className="secondary-btn" onClick={()=>{
                const blob=new Blob([JSON.stringify(result,null,2)],{type:"application/json"});
                const downloadUrl=URL.createObjectURL(blob);
                const link=document.createElement("a");
                link.href=downloadUrl;
                link.download=(selectedTool.key||"tool")+"-response.json";
                document.body.appendChild(link);
                link.click();
                link.remove();
                URL.revokeObjectURL(downloadUrl);
              }}>Download JSON</button>
            </div>
            <div style={{padding:12,borderRadius:12,background:"#f5f8ff",color:"#14294d",marginBottom:12,overflowWrap:"anywhere"}}>
              <strong>Response</strong>
              <pre style={{margin:"8px 0 0",fontFamily:"inherit",whiteSpace:"pre-wrap"}}>{typeof result==="string"?result:JSON.stringify(result,null,2)}</pre>
            </div>
            <details>
              <summary style={{cursor:"pointer",fontWeight:800,color:"#075fe0"}}>View raw JSON</summary>
              <pre style={{margin:"10px 0 0",fontFamily:"monospace",whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{JSON.stringify(result,null,2)}</pre>
            </details>
          </div>
        )}
        <p className="notice"><ShieldCheck size={13} style={{verticalAlign:"middle",marginRight:5}}/>Use only information you are authorized to access. Results may be approximate or incomplete; verify important details with primary sources.</p>
      </div>}

      {page === "Notifications" && <div className="content-panel" style={{maxWidth:"none"}}><div className="section-head" style={{marginTop:0}}><h3>Announcements & Notifications</h3><button className="text-link" onClick={()=>navTo("Home")}>Back to dashboard</button></div>{noticeLoading ? <div className="empty">Loading announcements…</div> : announcements.length ? <div className="tool-list">{announcements.map((item,i)=><div className="tool-row" key={i}><div className="tool-icon"><Bell size={18}/></div><span><strong>{item.title}</strong><small>{item.body} · {new Date(item.created_at).toLocaleString()}</small></span></div>)}</div> : <div className="empty">No new announcements.</div>}</div>}

      {page === "Store" && <div className="content-panel" style={{maxWidth:"none"}}>
        <div className="section-head" style={{marginTop:0}}><h3><Store size={18} style={{verticalAlign:"middle",marginRight:8}}/>CyberX Store</h3><span className="notice">Manual payment review</span></div>
        {paymentQr&&<div style={{textAlign:"center",padding:16,background:"#fff",borderRadius:18,marginBottom:16}}><img src={paymentQr} alt="Admin payment QR" style={{width:220,maxWidth:"100%",height:"auto",objectFit:"contain"}}/><p style={{color:"#123",fontWeight:700}}>Scan to pay</p></div>}
        {paymentInstructions&&<p className="notice">{paymentInstructions}</p>}
        <div className="tool-grid">{plans.map(plan=><button className="tool-card" key={plan.id} onClick={()=>setSelectedPlan(plan.id)} style={{outline:selectedPlan===plan.id?"2px solid #0872f9":undefined}}><div className="tool-icon"><Crown size={20}/></div><strong>{plan.name}</strong><div className="stat-value">₹{plan.price_inr}</div><small>{plan.credits} credits · {plan.duration_days} days</small><small>{plan.description}</small></button>)}</div>
        {selectedPlan&&<div style={{marginTop:18}}><label className="field-label">Payment reference / UTR</label><input className="field" value={paymentReference} onChange={e=>setPaymentReference(e.target.value)} placeholder="Enter UTR / transaction reference"/><label className="field-label">Payment screenshot (optional)</label><input className="field" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setPaymentProof(e.target.files?.[0]||null)}/><button className="primary-btn" style={{marginTop:14}} disabled={savingPayment} onClick={()=>void submitPayment()}>{savingPayment?"Submitting…":"Submit payment for review"}</button></div>}
        {storeMessage&&<p className={storeMessage.startsWith("Payment submitted")?"notice":"error"}>{storeMessage}</p>}
        <p className="notice">Your plan and credits activate only after admin verification. No automatic payment is claimed.</p>
      </div>}
      {page === "History" && <div className="content-panel" style={{maxWidth:"none"}}><div className="section-head" style={{marginTop:0}}><h3>Search history</h3><button className="text-link" onClick={()=>void clearHistory()}>Clear history</button></div>{history.length? <div className="tool-list">{history.map((item,i)=><div className="tool-row" key={i}><div className="tool-icon"><Clock3 size={18}/></div><span><strong>{item.title}</strong><small>{item.query} · {item.date}</small></span></div>)}</div>:<div className="empty">No searches yet. Your activity will show here.</div>}</div>}

      {page === "Profile" && <><div className="profile-card"><div className="profile-avatar">{avatarUrl?<img src={avatarUrl} alt="Profile" style={{width:"100%",height:"100%",borderRadius:"50%",objectFit:"cover"}}/>:<User size={26}/>}</div><div><strong>{profileName || userEmail?.split("@")[0] || "Guest workspace"}</strong><div className="notice" style={{margin:0}}>{userEmail||"Not signed in"}</div></div></div><div className="content-panel"><h3 style={{marginTop:0}}>Edit Profile</h3>{userEmail ? <><label className="field-label">Profile image</label><input className="field" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const file=e.target.files?.[0];if(file)void uploadAvatar(file);}}/><label className="field-label">Name</label><input className="field" value={profileName} onChange={e=>setProfileName(e.target.value)} maxLength={60}/><label className="field-label">Username</label><input className="field" value={username} onChange={e=>setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g,"").slice(0,24))} placeholder="your_username" maxLength={24}/><label className="field-label">Bio</label><textarea className="field" value={profileBio} onChange={e=>setProfileBio(e.target.value)} maxLength={240} rows={4}/><div className="stats" style={{marginTop:16}}><div className="stat-card"><div className="stat-label">CURRENT PLAN</div><div className="stat-value">{planName}</div><small>{planExpires?new Date(planExpires).toLocaleDateString():"No expiry"}</small></div><div className="stat-card"><div className="stat-label">AVAILABLE CREDITS</div><div className="stat-value">{credits}</div></div></div><div className="content-panel" style={{marginTop:16}}><h3><Gift size={18} style={{verticalAlign:"middle",marginRight:6}}/>Referral Program</h3><p className="notice">Rewards are configured by the administrator.</p><div className="tool-row"><strong>{referralCode||"Generating…"}</strong><button className="secondary-btn" onClick={()=>void navigator.clipboard.writeText(window.location.origin+"/?ref="+referralCode)}><Copy size={14}/> Copy invite link</button></div><div className="stats"><div className="stat-card"><div className="stat-label">REFERRALS</div><div className="stat-value">{referralCount}</div></div><div className="stat-card"><div className="stat-label">CREDITS EARNED</div><div className="stat-value">{referralCredits}</div></div></div></div><button className="primary-btn" style={{marginTop:16}} disabled={profileSaving} onClick={()=>void saveProfile()}><Save size={15} style={{verticalAlign:"middle",marginRight:6}}/>{profileSaving?"Saving…":"Save profile"}</button>{profileMessage&&<p className={profileMessage.includes("successfully")?"notice":"error"}>{profileMessage}</p>}<button className="secondary-btn" style={{marginLeft:8}} onClick={logout}><LogOut size={15} style={{verticalAlign:"middle",marginRight:6}}/>Logout</button></> : <><p className="notice">Sign in or create an account to edit your profile and sync history.</p><button className="primary-btn" onClick={()=>{setAuthMode("login");setPage("Login");}}>Login</button><button className="secondary-btn" style={{marginLeft:8}} onClick={()=>{setAuthMode("register");setPage("Register");}}>Register</button></>}</div></>}

      {page === "Settings" && <div className="content-panel"><h3 style={{marginTop:0}}>Settings & Privacy</h3><div className="tool-row"><div className="tool-icon"><ShieldCheck size={19}/></div><span><strong>Privacy-first research</strong><small>Only public technical information tools are enabled.</small></span><CheckCircle2 color="#12a56a"/></div><div className="tool-row"><div className="tool-icon"><Database size={19}/></div><span><strong>Data storage</strong><small>Signed-in search history is saved securely to your Supabase account.</small></span></div><div className="tool-row"><div className="tool-icon"><LockKeyhole size={19}/></div><span><strong>Authentication</strong><small>{supabase?"Supabase is configured.":"Supabase is not configured yet."}</small></span></div><div className="notice">To enable authentication, set the two public Supabase environment variables shown in .env.example. Never expose a service-role key in client-side code.</div><button className="secondary-btn" style={{marginTop:16}} onClick={()=>navTo("Profile")}>Account settings</button></div>}
    </main>

    <nav className="mobile-nav">{[{label:"Home",icon:Home},{label:"Tools",icon:LayoutGrid},{label:"Store",icon:Store},{label:"History",icon:History},{label:"Profile",icon:User}].map(({label,icon:Icon})=><button key={label} className={(page===label||(label==="Tools"&&page==="All Tools")||(label==="Tools"&&page==="Tool")?"active":"")} onClick={()=>navTo(label==="Tools"?"All Tools":label)}><Icon/><span>{label}</span></button>)}</nav>
  </div>;
}
