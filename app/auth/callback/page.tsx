"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { firebaseAuth, firestore } from "@/lib/firebase/client";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Checking your Firebase sign-in…");
  useEffect(() => {
    const db = firestore;
    const auth = firebaseAuth;
    if (!auth || !db) { setMessage("Firebase is not configured. Contact the site administrator."); return; }
    const stop = onAuthStateChanged(auth, async user => {
      if (!user) { setMessage("No active sign-in was found. Return to the app and sign in again."); return; }
      const params = new URLSearchParams(window.location.search);
      const requested = params.get("next") || "/";
      const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";
      if (next.startsWith("/admin")) {
        const profile = await getDoc(doc(db, "profiles", user.uid));
        if (!profile.exists() || profile.data().role !== "admin" || profile.data().status !== "active") {
          setMessage("This Firebase account has not been granted administrator access.");
          return;
        }
      }
      window.location.replace(next);
    });
    return () => stop();
  }, []);
  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:20,background:"radial-gradient(circle at 50% 0,#123f78,#06132c 65%)",color:"#fff",fontFamily:"Arial,Helvetica,sans-serif"}}><section style={{width:"min(100%,420px)",padding:28,borderRadius:20,border:"1px solid #1a5793",background:"#0a1c39",textAlign:"center"}}><h1>CyberX OSINT</h1><p style={{fontSize:13,lineHeight:1.7,color:"#b6c9e3"}}>{message}</p><a href="/" style={{color:"#64caff"}}>Return to app</a></section></main>;
}
