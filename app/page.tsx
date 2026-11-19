"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Activity, ArrowLeft, ArrowRight, Bell, CheckCircle2, ChevronRight, Clock3,
  Compass, Crown, Database, Globe2, History, Home, KeyRound, LayoutGrid,
  Link2, LockKeyhole, LogIn, LogOut, Mail, Menu, Moon, Search, Settings,
  Shield, ShieldCheck, Smartphone, Sparkles, User, UserRoundSearch, Users,
  Wifi, X, Zap, Image as ImageIcon, Share2, Network, Fingerprint, ExternalLink, Save, Edit3
} from "lucide-react";

type ToolKey = "ip" | "domain" | "username" | "email" | "url" | "dns" | "image" | "social" | "breach";
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
  const [page, setPage] = useState("Home");
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
  const [authMessage, setAuthMessage] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);

  const selectedTool = useMemo(() => tools.find((item) => item.key === tool)!, [tool]);

  async function hydrateUser(user: { id: string; email?: string | null }) {
    if (!supabase) return;
    const { data: profile } = await supabase.from("profiles").select("status,display_name,bio").eq("id", user.id).maybeSingle();
    if (profile?.status && profile.status !== "active") {
      await supabase.auth.signOut();
      setUserEmail("");
      setAuthMessage("This account is currently suspended or restricted. Contact the site administrator.");
      return;
    }
    setUserEmail(user.email || "");
    setProfileName(profile?.display_name || user.user_metadata?.name || user.email?.split("@")[0] || "");
    setProfileBio(profile?.bio || "");
    const { data } = await supabase.from("search_history").select("tool_slug,input_summary,created_at")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(30);
    if (data) setHistory(data.map((item) => ({
      title: tools.find((entry) => entry.key === item.tool_slug)?.title || item.tool_slug,
      query: item.input_summary,
      date: new Date(item.created_at).toLocaleString()
    })));
  }

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active && data.session?.user) void hydrateUser(data.session.user);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session) setUserEmail("");
      else void hydrateUser(session.user);
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
    setBusy(true); setError(""); setResult(null);
    try {
      let data: unknown;
      if (tool === "ip") {
        const response = await fetch("/api/ip?address=" + encodeURIComponent(query.trim()));
        data = await response.json();
        if (!response.ok) throw new Error((data as { error?: string }).error || "Lookup failed.");
      } else if (tool === "domain") {
        const response = await fetch("/api/domain?domain=" + encodeURIComponent(query.trim()));
        data = await response.json();
        if (!response.ok) throw new Error((data as { error?: string }).error || "Lookup failed.");
      } else if (tool === "dns") {
        const host = query.trim().toLowerCase().replace(/^https?:\\/\\//, "").split("/")[0];
        const response = await fetch("/api/dns?domain=" + encodeURIComponent(host));
        data = await response.json();
        if (!response.ok) throw new Error((data as {error?:string}).error || "DNS lookup failed.");
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
        const valid = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(query.trim());
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
      : await supabase.auth.signUp({ email, password, options: { data: { name: displayName } } });
    if (response.error) setAuthMessage(response.error.message);
    else if (authMode === "register" && !response.data.session) setAuthMessage("Account created. Check your email to confirm your address.");
    else if (response.data.user && response.data.session) {
      await hydrateUser(response.data.user);
      setPage("Home");
    } else { setAuthMessage("Account created. Check your email to confirm your address."); }
  }
  async function saveProfile() {
    if (!supabase) return;
    setProfileSaving(true); setProfileMessage("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setProfileMessage("Please sign in again."); setProfileSaving(false); return; }
    const { error } = await supabase.from("profiles").update({
      display_name: profileName.trim(), bio: profileBio.trim(), updated_at: new Date().toISOString()
    }).eq("id", user.id);
    setProfileMessage(error ? error.message : "Profile updated successfully.");
    setProfileSaving(false);
  }\n\n  async function clearHistory() {
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
    { label: "Home", icon: Home }, { label: "All Tools", icon: LayoutGrid },
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
      <div className="auth-switch">{authMode === "login" ? "Don't have an account?" : "Already registered?"} <button onClick={()=>{setAuthMode(authMode==="login"?"register":"login");setAuthMessage("");}}>{authMode==="login"?"Register":"Login"}</button></div>
      <div className="notice">Your account is handled by Supabase Auth when configured. Never share your password or verification codes.</div>
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
        <div className="top-actions"><button className="icon-btn" aria-label="Notifications"><Bell size={17}/></button>{userEmail ? <><button className="secondary-btn" onClick={()=>navTo("Profile")}><Edit3 size={14} style={{verticalAlign:"middle",marginRight:5}}/>Profile Edit</button><div className="avatar">{userEmail[0].toUpperCase()}</div></> : <><button className="secondary-btn" onClick={()=>{setAuthMode("login");setPage("Login");}}>Login</button><button className="primary-btn" onClick={()=>{setAuthMode("register");setPage("Register");}}>Register</button></>}</div>
      </header>

      {page === "Home" && <>
        <section className="welcome"><div><div className="eyebrow" style={{color:"#a8d9ff"}}>YOUR PUBLIC-SOURCE RESEARCH HUB</div><h2>Welcome back, {userEmail ? userEmail.split("@")[0] : "CyberKing"} 👋</h2><p>Explore public technical information with a clean, privacy-conscious workspace. Keep your research organized and transparent.</p></div><div className="welcome-tag"><Activity size={13} style={{verticalAlign:"middle",marginRight:6}}/> SYSTEM READY</div></section>
        <section className="stats">
          <div className="stat-card"><div className="stat-icon"><LayoutGrid size={20}/></div><div><div className="stat-label">AVAILABLE TOOLS</div><div className="stat-value">{tools.length.toString().padStart(2,"0")}</div></div></div>
          <div className="stat-card"><div className="stat-icon"><History size={20}/></div><div><div className="stat-label">YOUR SEARCHES</div><div className="stat-value">{history.length.toString().padStart(2,"0")}</div></div></div>
          <div className="stat-card"><div className="stat-icon"><ShieldCheck size={20}/></div><div><div className="stat-label">PRIVACY MODE</div><div className="stat-value" style={{fontSize:17}}>Enabled</div></div></div>
        </section>
        <div className="section-head"><h3>Quick Tools</h3><button className="text-link" onClick={()=>navTo("All Tools")}>View all <ArrowRight size={14} style={{verticalAlign:"middle"}}/></button></div>
        <div className="tool-grid">{tools.slice(0,6).map((item)=>{const Icon=item.icon;return <button className="tool-card" key={item.key} onClick={()=>goTool(item.key)}><div className="tool-icon"><Icon size={21}/></div><strong>{item.title}</strong><small>{item.description}</small></button>})}</div>
        <section className="premium"><div><h3><Crown size={17} style={{verticalAlign:"middle",marginRight:6,color:"#ffd66b"}}/> CyberX Research Suite</h3><p>Organize public-source checks in one mobile-friendly place.</p></div><button className="primary-btn" onClick={()=>navTo("All Tools")}>Explore tools</button></section>
        <div className="section-head"><h3>Recent activity</h3><button className="text-link" onClick={()=>navTo("History")}>History <ArrowRight size={14} style={{verticalAlign:"middle"}}/></button></div>
        {history.length ? <div className="tool-list">{history.slice(0,3).map((item,i)=><div className="tool-row" key={i}><div className="tool-icon"><Clock3 size={18}/></div><span><strong>{item.title}</strong><small>{item.query} · {item.date}</small></span><ChevronRight size={17}/></div>)}</div> : <div className="panel empty">Your recent research will appear here after your first lookup.</div>}
      </>}

      {page === "All Tools" && <>
        <div className="content-panel" style={{maxWidth:"none",marginBottom:16}}><div style={{display:"flex",alignItems:"center",gap:10}}><Search color="#0872f9"/><div><strong style={{fontSize:14}}>Find a research tool</strong><div className="notice" style={{margin:0}}>Choose a public-source utility below.</div></div></div></div>
        <div className="tool-list">{tools.map((item)=>{const Icon=item.icon;return <button className="tool-row" key={item.key} onClick={()=>goTool(item.key)}><div className="tool-icon"><Icon size={20}/></div><span><strong>{item.title}</strong><small>{item.description}</small></span><ChevronRight size={18}/></button>})}</div>
        <div className="notice">CyberX does not offer private-person tracking, account intrusion, password discovery, or leaked personal-data searches.</div>
      </>}

      {page === "Tool" && <div className="content-panel">
        <div className="page-topline"><button className="back-btn" onClick={()=>navTo("All Tools")}><ArrowLeft size={19}/></button><div><strong>{selectedTool.title}</strong><div className="notice" style={{margin:0}}>{selectedTool.description}</div></div></div>
        <div className="tool-icon" style={{width:58,height:58,marginTop:22}}><PageIcon size={28}/></div>
        <label className="field-label">{tool==="ip"?"Enter public IP address":tool==="domain"||tool==="dns"?"Enter domain name":tool==="email"||tool==="breach"?"Enter email address":tool==="username"||tool==="social"?"Enter public username":tool==="image"?"Enter public image URL":"Enter website URL"}</label>
        <div className="form-row"><input className="field" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder={tool==="ip"?"8.8.8.8":tool==="domain"||tool==="dns"?"example.com":tool==="email"||tool==="breach"?"name@example.com":tool==="username"||tool==="social"?"public_username": "https://example.com/image.jpg"} onKeyDown={(e)=>{if(e.key==="Enter")runTool();}}/><button className="primary-btn" disabled={busy||!query.trim()} onClick={runTool}>{busy?"Checking…":tool==="ip"||tool==="dns"?"Lookup":tool==="domain"||tool==="url"?"Analyze":"Check"} <ArrowRight size={15} style={{verticalAlign:"middle"}}/></button></div>
        {error && <div className="error">{error}</div>}
        {result !== null && <div className="result-box"><div style={{display:"flex",alignItems:"center",gap:8,color:"#0872f9",fontWeight:800,marginBottom:10}}><CheckCircle2 size={17}/> Result</div>{Array.isArray((result as {publicLinks?:unknown[]}).publicLinks) || Array.isArray((result as {publicSearchLinks?:unknown[]}).publicSearchLinks) || Array.isArray((result as {links?:unknown[]}).links) ? <><strong>{(result as {username?:string}).username ? "Public links for @"+(result as {username:string}).username : (result as {service?:string}).service || "Search options"}</strong>{(((result as {publicLinks?:[string,string][]}).publicLinks || (result as {publicSearchLinks?:[string,string][]}).publicSearchLinks || (result as {links?:[string,string][]}).links || [])).map(([name,url])=><div key={name} style={{padding:"8px 0",borderBottom:"1px solid #dceaff"}}><a href={url} target="_blank" rel="noreferrer" style={{color:"#075fe0",fontWeight:700}}>{name} — Open <ExternalLink size={13} style={{verticalAlign:"middle"}}/></a></div>)}<p className="notice">{(result as {note?:string}).note}</p></> : <pre style={{margin:0,fontFamily:"inherit",whiteSpace:"pre-wrap"}}>{JSON.stringify(result,null,2)}</pre>}</div>}
        <p className="notice"><ShieldCheck size={13} style={{verticalAlign:"middle",marginRight:5}}/>Use only information you are authorized to access. Results may be approximate or incomplete; verify important details with primary sources.</p>
      </div>}

      {page === "History" && <div className="content-panel" style={{maxWidth:"none"}}><div className="section-head" style={{marginTop:0}}><h3>Search history</h3><button className="text-link" onClick={()=>void clearHistory()}>Clear history</button></div>{history.length? <div className="tool-list">{history.map((item,i)=><div className="tool-row" key={i}><div className="tool-icon"><Clock3 size={18}/></div><span><strong>{item.title}</strong><small>{item.query} · {item.date}</small></span></div>)}</div>:<div className="empty">No searches yet. Your activity will show here.</div>}</div>}

      {page === "Profile" && <><div className="profile-card"><div className="profile-avatar"><User size={26}/></div><div><strong>{profileName || userEmail?.split("@")[0] || "Guest workspace"}</strong><div className="notice" style={{margin:0}}>{userEmail||"Not signed in"}</div></div></div><div className="content-panel"><h3 style={{marginTop:0}}>Edit Profile</h3>{userEmail ? <><label className="field-label">Display name</label><input className="field" value={profileName} onChange={e=>setProfileName(e.target.value)} maxLength={60}/><label className="field-label">Bio</label><textarea className="field" value={profileBio} onChange={e=>setProfileBio(e.target.value)} maxLength={240} rows={4}/><button className="primary-btn" style={{marginTop:16}} disabled={profileSaving} onClick={()=>void saveProfile()}><Save size={15} style={{verticalAlign:"middle",marginRight:6}}/>{profileSaving?"Saving…":"Save profile"}</button>{profileMessage&&<p className={profileMessage.includes("successfully")?"notice":"error"}>{profileMessage}</p>}<button className="secondary-btn" style={{marginLeft:8}} onClick={logout}><LogOut size={15} style={{verticalAlign:"middle",marginRight:6}}/>Logout</button></> : <><p className="notice">Sign in or create an account to edit your profile and sync history.</p><button className="primary-btn" onClick={()=>{setAuthMode("login");setPage("Login");}}>Login</button><button className="secondary-btn" style={{marginLeft:8}} onClick={()=>{setAuthMode("register");setPage("Register");}}>Register</button></>}</div></>}

      {page === "Settings" && <div className="content-panel"><h3 style={{marginTop:0}}>Settings & Privacy</h3><div className="tool-row"><div className="tool-icon"><ShieldCheck size={19}/></div><span><strong>Privacy-first research</strong><small>Only public technical information tools are enabled.</small></span><CheckCircle2 color="#12a56a"/></div><div className="tool-row"><div className="tool-icon"><Database size={19}/></div><span><strong>Data storage</strong><small>Signed-in search history is saved securely to your Supabase account.</small></span></div><div className="tool-row"><div className="tool-icon"><LockKeyhole size={19}/></div><span><strong>Authentication</strong><small>{supabase?"Supabase is configured.":"Supabase is not configured yet."}</small></span></div><div className="notice">To enable authentication, set the two public Supabase environment variables shown in .env.example. Never expose a service-role key in client-side code.</div><button className="secondary-btn" style={{marginTop:16}} onClick={()=>navTo("Profile")}>Account settings</button></div>}
    </main>

    <nav className="mobile-nav">{[{label:"Home",icon:Home},{label:"Tools",icon:LayoutGrid},{label:"History",icon:History},{label:"Profile",icon:User}].map(({label,icon:Icon})=><button key={label} className={(page===label||(label==="Tools"&&page==="All Tools")||(label==="Tools"&&page==="Tool")?"active":"")} onClick={()=>navTo(label==="Tools"?"All Tools":label)}><Icon/><span>{label}</span></button>)}</nav>
  </div>;
}
