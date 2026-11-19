"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = url && key ? createClient(url, key) : null;

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Completing secure sign-in…");

  useEffect(() => {
    let active = true;
    async function finishSignIn() {
      try {
        if (!supabase) throw new Error("Supabase is not configured. Please contact the site administrator.");
        const currentUrl = new URL(window.location.href);
        const providerError = currentUrl.searchParams.get("error_description") || currentUrl.searchParams.get("error");
        if (providerError) throw new Error(providerError.replaceAll("+", " "));

        const code = currentUrl.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) throw new Error(userError?.message || "Sign-in session was not created. Please try again.");

        const requestedNext = currentUrl.searchParams.get("next") || "/";
        const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/";
        if (next === "/admin" || next.startsWith("/admin/")) {
          const { data: profile, error } = await supabase.from("profiles").select("role,status").eq("id", user.id).maybeSingle();
          if (error) throw new Error("Could not verify administrator access: " + error.message);
          if (profile?.role !== "admin" || profile?.status !== "active") {
            throw new Error("This Google/GitHub account is not assigned active administrator access.");
          }
        }
        if (active) window.location.replace(next);
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Sign-in failed. Please try again.");
      }
    }
    void finishSignIn();
    return () => { active = false; };
  }, []);

  return (
    <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:20,background:"radial-gradient(circle at 50% 0,#123f78,#06132c 65%)",color:"#fff",fontFamily:"Arial,Helvetica,sans-serif"}}>
      <section style={{width:"min(100%,420px)",padding:28,borderRadius:20,border:"1px solid #1a5793",background:"#0a1c39",textAlign:"center",boxShadow:"0 25px 70px #0008"}}>
        <div style={{width:48,height:48,margin:"0 auto 18px",display:"grid",placeItems:"center",borderRadius:15,background:"linear-gradient(145deg,#21c8ff,#0757e9)",fontSize:22}}>✦</div>
        <h1 style={{fontSize:22,margin:"0 0 12px"}}>CyberX OSINT</h1>
        <p style={{fontSize:13,lineHeight:1.7,color:"#b6c9e3"}}>{message}</p>
        {message !== "Completing secure sign-in…" && <a href="/admin" style={{display:"inline-block",marginTop:14,color:"#64caff",fontSize:12}}>Return to Admin Login</a>}
      </section>
    </main>
  );
}
