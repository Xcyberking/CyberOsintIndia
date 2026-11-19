"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import {
  ArrowLeft, ArrowRight, Bell, Check, ChevronRight, Chrome, CircleHelp, Crown, ExternalLink, Eye, EyeOff,
  Fingerprint, Gem, Github, Globe2, History, Home, Image as ImageIcon, Info, Languages, LayoutGrid, Lock,
  LogOut, Mail, Menu, Moon, Network, Search, Settings, Share2, ShieldCheck, Smartphone, Trash2, User,
  UserRoundSearch, Wifi
} from "lucide-react";
import Logo from "./Logo";

type ToolKey = "username" | "email" | "phone" | "ip" | "url" | "image" | "social" | "breach" | "domain" | "dns";
type Tool = { key: ToolKey; slug: string; title: string; sub: string; icon: typeof Globe2; label: string; btn: string; group: "tools" | "searches" };
const tools: Tool[] = [
  { key: "username", slug: "username-tracker", title: "Username Tracker", sub: "Find public profile pages for a username", icon: UserRoundSearch, label: "Enter Username", btn: "Search", group: "searches" },
  { key: "email", slug: "email-validator", title: "Email Lookup", sub: "Validate an email and inspect its mail domain", icon: Mail, label: "Enter Email Address", btn: "Check", group: "tools" },
  { key: "phone", slug: "phone-lookup", title: "Phone Tracker", sub: "Number format, country and line type", icon: Smartphone, label: "Enter Phone (+91 98765 43210)", btn: "Lookup", group: "tools" },
  { key: "ip", slug: "ip-lookup", title: "IP Lookup", sub: "Approximate metadata for a public IP", icon: Wifi, label: "Enter IP Address", btn: "Lookup", group: "tools" },
  { key: "url", slug: "url-safety", title: "Website Analyzer", sub: "URL structure, HTTPS and DNS details", icon: Globe2, label: "Enter Website URL", btn: "Analyze", group: "tools" },
  { key: "domain", slug: "domain-lookup", title: "Domain Analyzer", sub: "Public RDAP registration records", icon: ShieldCheck, label: "Enter Domain Name", btn: "Analyze", group: "tools" },
  { key: "dns", slug: "dns-lookup", title: "DNS Lookup", sub: "A, AAAA, MX, NS and TXT records", icon: Network, label: "Enter Domain Name", btn: "Lookup", group: "tools" },
  { key: "image", slug: "reverse-image-search", title: "Reverse Image Search", sub: "Find similar images on the web", icon: ImageIcon, label: "Paste Image URL", btn: "Search", group: "searches" },
  { key: "social", slug: "social-media-analyzer", title: "Social Media Analyzer", sub: "Open public profiles across platforms", icon: Share2, label: "Enter Username", btn: "Analyze", group: "searches" },
  { key: "breach", slug: "breach-self-check", title: "Data Breach Check", sub: "Check if your own data is leaked", icon: Fingerprint, label: "Enter Your Email", btn: "Check", group: "searches" }
];

type Res = { title: string; rows: [string, string][]; links: [string, string][]; note?: string };
type HistoryItem = { key: string; title: string; query: string; date: string };
type Plan = { id: string; name: string; price_inr: number; credits: number; duration_days: number; description: string | null };
type Page = "Splash" | "Login" | "Register" | "Home" | "Tools" | "Tool" | "History" | "Premium" | "Settings" | "About" | "Notifications" | "Account" | "Privacy" | "Help";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const pretty = (k: string) => k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ").replace(/^./, (c) => c.toUpperCase());
function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.map(fmt).join(", ");
  if (typeof v === "object") return Object.entries(v as Record<string, unknown>).map(([a, b]) => pretty(a) + ": " + fmt(b)).join(" · ");
  return String(v);
}
function toRows(data: unknown): [string, string][] {
  if (!data || typeof data !== "object") return [["Result", fmt(data)]];
  return Object.entries(data as Record<string, unknown>).filter(([k]) => k !== "note" && k !== "error").map(([k, v]) => [pretty(k), fmt(v)]);
}
const noteOf = (data: unknown) => (data && typeof data === "object" ? ((data as { note?: string }).note) : undefined);
const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const handleOk = (v: string) => /^[a-zA-Z0-9._-]{2,30}$/.test(v);
async function getJson(url: string, fallback: string) {
  const r = await fetch(url);
  const d = await r.json();
  if (!r.ok) throw new Error((d as { error?: string }).error || fallback);
  return d as unknown;
}

export default function HomePage() {
  const [page, setPage] = useState<Page>("Splash");
  const [tool, setTool] = useState<ToolKey>("ip");
  const [query, setQuery] = useState("");
  const [res, setRes] = useState<Res | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [tab, setTab] = useState<"all" | "tools" | "searches">("all");
  const [toolSearch, setToolSearch] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileMsg, setProfileMsg] = useState("");
  const [announcements, setAnnouncements] = useState<{ title: string; body: string; created_at: string }[]>([]);
  const [unread, setUnread] = useState(false);
  const [disabledSlugs, setDisabledSlugs] = useState<string[]>([]);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [planId, setPlanId] = useState("");
  const [planMsg, setPlanMsg] = useState("");
  const [dark, setDark] = useState(true);
  const [helpSubject, setHelpSubject] = useState("");
  const [helpBody, setHelpBody] = useState("");
  const [helpMsg, setHelpMsg] = useState("");

  const visibleTools = useMemo(() => tools.filter((t) => !disabledSlugs.includes(t.slug)), [disabledSlugs]);
  const selected = tools.find((t) => t.key === tool)!;
  const name = profileName || userEmail.split("@")[0] || "Guest";

  useEffect(() => { try { if (localStorage.getItem("cx-theme") === "light") setDark(false); } catch { /* storage unavailable */ } }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try { localStorage.setItem("cx-theme", dark ? "dark" : "light"); } catch { /* storage unavailable */ }
  }, [dark]);
  useEffect(() => {
    if (page !== "Splash") return;
    const t = setTimeout(() => setPage("Home"), 1800);
    return () => clearTimeout(t);
  }, [page]);

  async function hydrateUser(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }) {
    if (!supabase) return;
    const { data: profile } = await supabase.from("profiles").select("status,display_name,bio").eq("id", user.id).maybeSingle();
    if (profile?.status && profile.status !== "active") {
      await supabase.auth.signOut();
      setUserEmail("");
      setAuthMessage("This account is currently suspended or restricted. Contact the site administrator.");
      return;
    }
    setUserEmail(user.email || "");
    setProfileName(profile?.display_name || (typeof user.user_metadata?.name === "string" ? user.user_metadata.name : "") || user.email?.split("@")[0] || "");
    setProfileBio(profile?.bio || "");
    const { data } = await supabase.from("search_history").select("tool_slug,input_summary,created_at")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
    if (data) setHistory(data.map((i) => ({
      key: i.tool_slug,
      title: tools.find((t) => t.key === i.tool_slug)?.title || i.tool_slug,
      query: i.input_summary,
      date: new Date(i.created_at).toLocaleString()
    })));
  }

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.from("tools").select("slug,enabled").then(({ data }) => {
      if (active && data) setDisabledSlugs(data.filter((r) => !r.enabled).map((r) => r.slug));
    });
    void supabase.from("announcements").select("id", { count: "exact", head: true }).eq("active", true).then(({ count }) => { if (active && count) setUnread(true); });
    void supabase.auth.getSession().then(({ data }) => { if (active && data.session?.user) void hydrateUser(data.session.user); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!active) return;
      if (!session) { setUserEmail(""); setProfileName(""); setProfileBio(""); setHistory([]); }
      else { setUserEmail(session.user.email || ""); Promise.resolve().then(() => void hydrateUser(session.user)); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const go = (p: Page) => { setPage(p); window.scrollTo(0, 0); };
  const openTool = (k: ToolKey) => { setTool(k); setQuery(""); setRes(null); setError(""); go("Tool"); };
  const needLogin = (m: "login" | "register") => { setAuthMode(m); setAuthMessage(""); go(m === "login" ? "Login" : "Register"); };

  async function addHistory(value: string) {
    setHistory((old) => [{ key: tool, title: selected.title, query: value, date: new Date().toLocaleString() }, ...old].slice(0, 50));
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.from("search_history").insert({ user_id: user.id, tool_slug: tool, input_summary: value.slice(0, 500), status: "success" });
    }
  }

  async function runTool() {
    setBusy(true); setError(""); setRes(null);
    const q = query.trim();
    try {
      let out: Res;
      if (tool === "ip") {
        const d = await getJson("/api/ip?address=" + encodeURIComponent(q), "Lookup failed.");
        out = { title: "Results", rows: toRows(d), links: [], note: noteOf(d) };
      } else if (tool === "domain") {
        const d = await getJson("/api/domain?domain=" + encodeURIComponent(q), "Lookup failed.");
        out = { title: "Results", rows: toRows(d), links: [], note: noteOf(d) };
      } else if (tool === "dns") {
        const host = q.toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
        const d = await getJson("/api/dns?domain=" + encodeURIComponent(host), "DNS lookup failed.");
        out = { title: "Results", rows: toRows(d), links: [], note: noteOf(d) };
      } else if (tool === "phone") {
        const p = parsePhoneNumberFromString(q);
        if (!p || !p.isPossible()) throw new Error("Enter the number with its country code, e.g. +91 98765 43210.");
        out = { title: "Results", rows: [
          ["International", p.formatInternational()], ["National", p.formatNational()],
          ["Country", p.country || "Unknown"], ["Calling code", "+" + p.countryCallingCode],
          ["Valid number", p.isValid() ? "Yes" : "No"], ["Line type", pretty((p.getType() || "unknown").toLowerCase())]
        ], links: [], note: "Format and numbering-plan data only. This does not identify the owner or locate the device." };
      } else if (tool === "email") {
        if (!emailOk(q)) throw new Error("Enter an email address in a valid format.");
        const domain = q.split("@")[1];
        const d = await getJson("/api/dns?domain=" + encodeURIComponent(domain), "Mail domain lookup failed.");
        const mx = (d as { records?: { type: string; records: { value: string }[] }[] }).records?.find((r) => r.type === "MX")?.records || [];
        out = { title: "Results", rows: [["Email", q], ["Syntax", "Valid format"], ["Domain", domain], ["MX records", mx.map((m) => m.value).join(", ") || "None found"]], links: [], note: "MX records show mail routing only; they do not verify the mailbox or identify its owner." };
      } else if (tool === "url") {
        const u = new URL(/^https?:\/\//.test(q) ? q : "https://" + q);
        if (!["http:", "https:"].includes(u.protocol)) throw new Error("Only HTTP and HTTPS website URLs are supported.");
        const r = await fetch("/api/dns?domain=" + encodeURIComponent(u.hostname));
        const d = await r.json();
        out = { title: "Results", rows: [["Website", u.href], ["Protocol", u.protocol.replace(":", "").toUpperCase()], ["Hostname", u.hostname], ["Port", u.port || "Default"], ["SSL", u.protocol === "https:" ? "HTTPS enabled" : "HTTP only"], ["DNS", r.ok ? fmt((d as { records?: unknown }).records) : fmt((d as { error?: string }).error)]], links: [], note: "Checks URL structure and public DNS only; it is not a malware or reputation verdict." };
      } else if (tool === "image") {
        const u = new URL(q);
        if (!["http:", "https:"].includes(u.protocol)) throw new Error("Enter a public HTTP or HTTPS image URL.");
        out = { title: "Search with", rows: [], links: [
          ["Google Lens", "https://lens.google.com/uploadbyurl?url=" + encodeURIComponent(u.href)],
          ["Bing Visual Search", "https://www.bing.com/images/searchbyimage?cbir=sbi&imgurl=" + encodeURIComponent(u.href)],
          ["TinEye", "https://tineye.com/search?url=" + encodeURIComponent(u.href)]
        ], note: "The image URL is shared with a provider only when you open its link. Use images you own or may search." };
      } else if (tool === "breach") {
        if (!emailOk(q)) throw new Error("Enter your own email address in a valid format.");
        out = { title: "Official check", rows: [["Service", "Have I Been Pwned"]], links: [["Open official self-check", "https://haveibeenpwned.com/"]], note: "Your email is not submitted by this app. Open the official service and enter it yourself." };
      } else {
        const h = q.replace(/^@/, "");
        if (!handleOk(h)) throw new Error("Enter a public username (2–30 letters, numbers, dots, underscores or hyphens).");
        const e = encodeURIComponent(h);
        const all: [string, string][] = [
          ["GitHub", "https://github.com/" + e], ["Instagram", "https://www.instagram.com/" + e + "/"], ["X", "https://x.com/" + e],
          ["TikTok", "https://www.tiktok.com/@" + e], ["Reddit", "https://www.reddit.com/user/" + e + "/"], ["YouTube", "https://www.youtube.com/@" + e],
          ["Facebook", "https://www.facebook.com/" + e], ["LinkedIn", "https://www.linkedin.com/in/" + e + "/"], ["Telegram", "https://t.me/" + e]
        ];
        out = { title: "Public profile links", rows: [["Username", h]], links: all, note: "Direct links only. Nothing is scraped and no match or identity is claimed." };
      }
      setRes(out);
      await addHistory(q);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally { setBusy(false); }
  }

  async function authenticate() {
    setAuthMessage("");
    if (authMode === "register" && password.length < 8) { setAuthMessage("Use a password with at least 8 characters."); return; }
    if (authMode === "register" && password !== confirmPassword) { setAuthMessage("Passwords do not match."); return; }
    if (!supabase) { setAuthMessage("Supabase is not configured. Check the public Supabase URL and publishable key."); return; }
    const r = authMode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { name: username } } });
    if (r.error) setAuthMessage(r.error.message);
    else if (r.data.user && r.data.session) { await hydrateUser(r.data.user); go("Home"); }
    else setAuthMessage("Account created. Check your email to confirm your address.");
  }
  async function oauth(provider: "google" | "github") {
    if (!supabase) { setAuthMessage("Supabase is not configured."); return; }
    const { error: e } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin + "/auth/callback?next=%2F", scopes: provider === "github" ? "read:user user:email" : "openid email profile" } });
    if (e) setAuthMessage(e.message);
  }
  async function forgot() {
    if (!supabase || !email.trim()) { setAuthMessage("Enter your email address first."); return; }
    const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    setAuthMessage(e ? e.message : "Password reset email sent if the account exists.");
  }
  async function logout() {
    if (supabase) await supabase.auth.signOut();
    setUserEmail(""); setProfileName(""); setProfileBio(""); setHistory([]); go("Home");
  }
  async function openNotifications() {
    go("Notifications"); setUnread(false);
    if (supabase) {
      const { data } = await supabase.from("announcements").select("title,body,created_at").eq("active", true).order("created_at", { ascending: false }).limit(30);
      setAnnouncements(data || []);
    }
  }
  async function saveProfile() {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setProfileMsg("Please sign in again."); return; }
    const { error: e } = await supabase.from("profiles").update({ display_name: profileName.trim(), bio: profileBio.trim(), updated_at: new Date().toISOString() }).eq("id", user.id);
    setProfileMsg(e ? e.message : "Profile updated successfully.");
  }
  async function clearHistory() {
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: e } = await supabase.from("search_history").delete().eq("user_id", user.id);
        if (e) { setError("Could not clear saved history: " + e.message); return; }
      }
    }
    setHistory([]);
  }
  async function sendTicket(subject: string, message: string): Promise<string> {
    if (!supabase) return "Supabase is not configured.";
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "Please login first.";
    const { error: e } = await supabase.from("support_tickets").insert({ user_id: user.id, subject, message });
    return e ? e.message : "Sent. The admin team will review your request.";
  }
  async function loadPlans() {
    if (plans || !supabase) { if (!supabase) setPlans([]); return; }
    const { data } = await supabase.from("premium_plans").select("id,name,price_inr,credits,duration_days,description").eq("is_active", true).order("price_inr");
    const list = (data || []) as Plan[];
    setPlans(list);
    if (list[0]) setPlanId(list[0].id);
  }

  const hdr = (title: string, back?: Page, right?: React.ReactNode) => (
    <div className="hdr">
      {back ? <button className="icon" aria-label="Back" onClick={() => go(back)}><ArrowLeft size={18} /></button> : <span className="sp" />}
      <h1>{title}</h1>
      {right || <span className="sp" />}
    </div>
  );
  const nav = (
    <nav className="nav">
      {([["Home", Home, "Home"], ["History", History, "History"], ["Premium", Crown, "Premium"], ["Settings", Settings, "Settings"]] as [string, typeof Home, Page][]).map(([label, Icon, p]) => (
        <button key={label} className={page === p || (p === "Home" && page === "Tools") ? "on" : ""} onClick={() => { if (p === "Premium") void loadPlans(); go(p); }}><Icon size={20} />{label}</button>
      ))}
    </nav>
  );
  const ToolIcon = selected.icon;

  if (page === "Splash") return (
    <div className="phone"><div className="splash center">
      <Logo size={150} />
      <div className="brandname">Cyber<b>X</b> OSINT</div>
      <div className="tag">Explore • Analyze • Investigate</div>
      <div className="bar"><i /></div>
    </div></div>
  );

  if (page === "Login" || page === "Register") {
    const reg = authMode === "register";
    return (
      <div className="phone">
        {hdr("", "Home")}
        <div className="authbox center">
          <Logo size={92} />
          <div className="brandname" style={{ fontSize: 28 }}>Cyber<b>X</b> OSINT</div>
          <div className="muted" style={{ marginBottom: 14 }}>{reg ? "Create New Account" : "Login to your account"}</div>
          {reg && <div className="fd"><User size={18} /><input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} /></div>}
          <div className="fd"><Mail size={18} /><input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="fd"><Lock size={18} /><input type={showPw ? "text" : "password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} /><button aria-label="Show password" onClick={() => setShowPw(!showPw)}>{showPw ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
          {reg && <div className="fd"><Lock size={18} /><input type={showPw ? "text" : "password"} placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div>}
          <button className="btn gap" onClick={authenticate}>{reg ? "Register" : "Login"}</button>
          {authMessage && <p className={authMessage.startsWith("Account created") || authMessage.startsWith("Password reset") ? "okm" : "err"}>{authMessage}</p>}
          {!reg && <button className="link" style={{ marginTop: 10 }} onClick={forgot}>Forgot Password?</button>}
          {!reg && <>
            <div className="divider">OR</div>
            <button className="btn alt" onClick={() => oauth("google")}><Chrome size={17} /> Continue with Google</button>
            <button className="btn alt gap" style={{ marginTop: 10 }} onClick={() => oauth("github")}><Github size={17} /> Continue with GitHub</button>
          </>}
          <div className="sw">{reg ? "Already have an account? " : "Don't have an account? "}<button className="link" onClick={() => { setAuthMode(reg ? "login" : "register"); setAuthMessage(""); setConfirmPassword(""); }}>{reg ? "Login" : "Register"}</button></div>
        </div>
      </div>
    );
  }

  if (page === "Tool") return (
    <div className="phone">
      {hdr(selected.title, "Tools")}
      <div className="hero"><div className="ring"><ToolIcon size={46} /></div></div>
      <input className="wf" value={query} placeholder={selected.label} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && query.trim()) void runTool(); }} />
      <button className="btn" disabled={busy || !query.trim()} onClick={runTool}>{busy ? "Checking…" : selected.btn}</button>
      {error && <p className="err">{error}</p>}
      {res && (
        <div className="res">
          <h3>{res.title}</h3>
          {res.rows.map(([k, v]) => <div className="kv" key={k}><span>{k}</span><b>{v}</b></div>)}
          {res.links.map(([n, u]) => <a className="lk" key={n} href={u} target="_blank" rel="noreferrer noopener">{n}<ExternalLink size={15} /></a>)}
          {res.note && <p className="note">{res.note}</p>}
        </div>
      )}
      <p className="note">Use only information you are authorized to access. Results may be approximate or incomplete.</p>
    </div>
  );

  let body: React.ReactNode = null;

  if (page === "Home") body = <>
    <div className="hdr" style={{ justifyContent: "space-between" }}>
      <button className="icon" aria-label="All tools" onClick={() => go("Tools")}><Menu size={18} /></button>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button className="icon" aria-label="Notifications" onClick={() => void openNotifications()}><Bell size={18} />{unread && <i />}</button>
        <button className="pill" onClick={() => { void loadPlans(); go("Premium"); }}><Crown size={14} /> Pro</button>
        {!userEmail && <button className="link" onClick={() => needLogin("login")}>Login</button>}
      </div>
    </div>
    <div className="welcome"><Logo size={62} /><div><h2>Welcome Back, {name} 👋</h2><div className="muted" style={{ fontSize: 12 }}>Explore public OSINT tools and uncover open information.</div></div></div>
    <div className="stats">
      <div><LayoutGrid size={20} /><b>{visibleTools.length}</b><small>Tools</small></div>
      <div><History size={20} /><b>{history.length}</b><small>Searches</small></div>
      <div><ShieldCheck size={20} /><b>Safe</b><small>Public data only</small></div>
    </div>
    <div className="sec"><h3>Quick Tools</h3><button className="link" onClick={() => go("Tools")}>View All <ArrowRight size={13} style={{ verticalAlign: "middle" }} /></button></div>
    <div className="g3">{visibleTools.slice(0, 6).map((t) => { const I = t.icon; return <button className="qt" key={t.key} onClick={() => openTool(t.key)}><span className="ic"><I size={20} /></span>{t.title}</button>; })}</div>
    <div className="banner"><div><b>Upgrade to Premium</b><p>Unlock all features!</p><button className="btn" onClick={() => { void loadPlans(); go("Premium"); }}>Go Premium →</button></div><Gem className="big" size={64} /></div>
    <div className="sec"><h3>Recent Activity</h3><button className="link" onClick={() => go("History")}>History</button></div>
    {history.length ? <div className="list dk">{history.slice(0, 3).map((h, i) => { const I = tools.find((t) => t.key === h.key)?.icon || Search; return <div className="item" key={i}><span className="ic"><I size={18} /></span><span><b>{h.title}</b><small>{h.query} · {h.date}</small></span></div>; })}</div> : <div className="empty">Your recent lookups will appear here.</div>}
  </>;

  if (page === "Tools") {
    const list = visibleTools.filter((t) => (t.title + t.sub).toLowerCase().includes(toolSearch.toLowerCase()));
    body = <>
      {hdr("All Tools", "Home")}
      <label className="search"><Search size={18} /><input placeholder="Search tools..." value={toolSearch} onChange={(e) => setToolSearch(e.target.value)} /></label>
      <div className="list">{list.map((t) => { const I = t.icon; return <button className="item" key={t.key} onClick={() => openTool(t.key)}><span className="ic"><I size={20} /></span><span><b>{t.title}</b><small>{t.sub}</small></span><ChevronRight size={18} /></button>; })}</div>
      {!list.length && <div className="empty">No tools match your search.</div>}
      <p className="note">Only tools enabled by the administrator are shown. No private-person tracking, account intrusion or leaked-data searches.</p>
    </>;
  }

  if (page === "History") {
    const items = history.filter((h) => tab === "all" || tools.find((t) => t.key === h.key)?.group === tab);
    body = <>
      {hdr("History", "Home")}
      <div className="tabs">{([["all", "All"], ["tools", "Tools"], ["searches", "Searches"]] as const).map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
      {items.length ? <div className="list">{items.map((h, i) => { const I = tools.find((t) => t.key === h.key)?.icon || Search; return <div className="item" key={i}><span className="ic"><I size={20} /></span><span><b>{h.title}</b><small>{h.query}</small><small>{h.date}</small></span></div>; })}</div> : <div className="empty">No searches yet. Your activity will show here.</div>}
      {history.length > 0 && <button className="btn danger gap" onClick={() => void clearHistory()}><Trash2 size={16} /> Clear History</button>}
      {!userEmail && <p className="note">Guest history lives only in this browser session. Login to sync it to your account.</p>}
      {error && <p className="err">{error}</p>}
    </>;
  }

  if (page === "Premium") {
    const best = plans && plans.length > 1 ? plans.reduce((a, b) => (b.duration_days > a.duration_days ? b : a)).id : "";
    const chosen = plans?.find((p) => p.id === planId);
    body = <>
      {hdr("Premium Plan", "Home")}
      <div className="crown"><Crown size={64} /><h2>Upgrade to Premium</h2><div>Get more power with advanced features</div></div>
      <ul className="checks">{["Higher credit allowance", "Ad-free experience", "Priority support", "Early access to new tools"].map((f) => <li key={f}><Check size={17} />{f}</li>)}</ul>
      {plans === null && <div className="empty">Loading plans…</div>}
      {plans && !plans.length && <div className="empty">No premium plans are published yet.</div>}
      {plans && plans.length > 0 && <div className="plans">{plans.slice(0, 4).map((p) => (
        <button key={p.id} className={"plan" + (p.id === planId ? " on" : "")} onClick={() => setPlanId(p.id)}>
          {p.id === best && <em>Best Value</em>}
          <small>{p.name}</small><b>₹{p.price_inr}</b><small>{p.credits} credits / {p.duration_days} days</small>
        </button>
      ))}</div>}
      {chosen?.description && <p className="note">{chosen.description}</p>}
      <button className="btn" disabled={!chosen} onClick={async () => {
        if (!userEmail) { needLogin("login"); return; }
        setPlanMsg(await sendTicket("Premium plan request: " + chosen!.name, "Plan " + chosen!.name + " (₹" + chosen!.price_inr + ", " + chosen!.credits + " credits). Requested from the app."));
      }}>Subscribe Now</button>
      {planMsg && <p className={planMsg.startsWith("Sent") ? "okm" : "err"}>{planMsg}</p>}
      <p className="note center">No payment gateway is connected yet. Subscribing sends a request to the admin, who activates your plan after payment is confirmed.</p>
    </>;
  }

  if (page === "Settings") body = <>
    {hdr("Settings", "Home")}
    <div className="prof"><Logo size={48} /><div><b>{name}</b><span className="muted">{userEmail || "Not signed in"}</span></div></div>
    <div className="sl">
      <button onClick={() => (userEmail ? go("Account") : needLogin("login"))}><User size={19} />Account Settings<ChevronRight size={17} style={{ marginLeft: "auto" }} /></button>
      <button onClick={() => void openNotifications()}><Bell size={19} />Notification Settings<ChevronRight size={17} style={{ marginLeft: "auto" }} /></button>
      <button onClick={() => setDark(!dark)}><Moon size={19} />Dark Mode<span className={"tg" + (dark ? " on" : "")} /></button>
      <div><Languages size={19} />Language<span className="v">English</span></div>
      <button onClick={() => go("Privacy")}><Lock size={19} />Privacy & Security<ChevronRight size={17} style={{ marginLeft: "auto" }} /></button>
      <button onClick={() => go("Help")}><CircleHelp size={19} />Help & Support<ChevronRight size={17} style={{ marginLeft: "auto" }} /></button>
      <button onClick={() => go("About")}><Info size={19} />About App<ChevronRight size={17} style={{ marginLeft: "auto" }} /></button>
    </div>
    {userEmail ? <button className="btn danger" onClick={logout}><LogOut size={16} /> Logout</button> : <button className="btn" onClick={() => needLogin("login")}>Login</button>}
  </>;

  if (page === "Account") body = <>
    {hdr("Account Settings", "Settings")}
    <label className="muted">Display name</label>
    <input className="wf" style={{ marginTop: 6 }} value={profileName} maxLength={60} onChange={(e) => setProfileName(e.target.value)} />
    <label className="muted">Bio</label>
    <textarea className="wf" style={{ marginTop: 6 }} value={profileBio} maxLength={240} onChange={(e) => setProfileBio(e.target.value)} />
    <button className="btn" onClick={() => void saveProfile()}>Save profile</button>
    {profileMsg && <p className={profileMsg.includes("successfully") ? "okm" : "err"}>{profileMsg}</p>}
  </>;

  if (page === "Privacy") body = <>
    {hdr("Privacy & Security", "Settings")}
    <div className="list dk">
      <div className="item"><span className="ic"><ShieldCheck size={19} /></span><span><b>Public data only</b><small>Only public technical information tools are enabled. IP lookups are approximate network metadata.</small></span></div>
      <div className="item"><span className="ic"><Lock size={19} /></span><span><b>Your account</b><small>{supabase ? "Signed-in history is stored in your own account, protected by row-level security." : "Supabase is not configured yet."}</small></span></div>
      <div className="item"><span className="ic"><Fingerprint size={19} /></span><span><b>Breach &amp; image checks</b><small>Your email and images are never sent to third parties by this app; links open the provider directly.</small></span></div>
    </div>
  </>;

  if (page === "Help") body = <>
    {hdr("Help & Support", "Settings")}
    <input className="wf" placeholder="Subject" value={helpSubject} onChange={(e) => setHelpSubject(e.target.value)} />
    <textarea className="wf" placeholder="Describe your issue" value={helpBody} onChange={(e) => setHelpBody(e.target.value)} />
    <button className="btn" disabled={!helpSubject.trim() || !helpBody.trim()} onClick={async () => { const m = await sendTicket(helpSubject.trim(), helpBody.trim()); setHelpMsg(m); if (m.startsWith("Sent")) { setHelpSubject(""); setHelpBody(""); } }}>Send to support</button>
    {helpMsg && <p className={helpMsg.startsWith("Sent") ? "okm" : "err"}>{helpMsg}</p>}
  </>;

  if (page === "Notifications") body = <>
    {hdr("Notifications", "Home")}
    {announcements.length ? <div className="list dk">{announcements.map((a, i) => <div className="item" key={i}><span className="ic"><Bell size={18} /></span><span><b>{a.title}</b><small>{a.body}</small><small>{new Date(a.created_at).toLocaleString()}</small></span></div>)}</div> : <div className="empty">No new announcements.</div>}
  </>;

  if (page === "About") body = <>
    {hdr("About CyberX OSINT", "Settings")}
    <div className="ab">
      <Logo size={120} />
      <div className="brandname" style={{ fontSize: 26 }}>Cyber<b>X</b> OSINT</div>
      <div className="muted">Version 1.0.0</div>
      <p className="tag" style={{ maxWidth: 300 }}>Your public-source OSINT toolkit to explore, analyze and investigate open information.</p>
      <div className="lnks">
        <a href="https://cyber-osint-india.vercel.app" target="_blank" rel="noreferrer"><span><Globe2 size={20} /></span>Website</a>
        <a href="https://github.com/Xcyberking/CyberOsintIndia" target="_blank" rel="noreferrer"><span><Github size={20} /></span>GitHub</a>
      </div>
      <div className="muted" style={{ fontSize: 11 }}>© 2026 CyberX OSINT. All rights reserved.</div>
    </div>
  </>;

  return <div className="phone">{body}{["Home", "Tools", "History", "Premium", "Settings"].includes(page) && nav}</div>;
}
