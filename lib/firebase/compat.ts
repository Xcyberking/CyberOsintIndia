"use client";

import { firebaseAuth, firestore, firebaseStorage, firebaseConfigured } from "./client";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, sendPasswordResetEmail, sendEmailVerification,
  updateProfile, GoogleAuthProvider, GithubAuthProvider, signInWithPopup, signInWithRedirect
} from "firebase/auth";
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query as fsQuery, where, limit as fsLimit, onSnapshot
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

type AnyRow = Record<string, any>;

const AUTH_MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Invalid login credentials. Email or password is incorrect.",
  "auth/invalid-login-credentials": "Invalid login credentials. Email or password is incorrect.",
  "auth/wrong-password": "Invalid login credentials. Email or password is incorrect.",
  "auth/user-not-found": "Invalid login credentials. Email or password is incorrect.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/email-already-in-use": "User already registered. This email already has an account.",
  "auth/weak-password": "Password is too weak. Use at least 8 characters.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
  "auth/user-disabled": "This account has been disabled by the administrator.",
  "auth/operation-not-allowed": "This sign-in method is not enabled in Firebase Authentication.",
  "auth/unauthorized-domain": "This domain is not authorized. Add it in Firebase Console > Authentication > Settings > Authorized domains.",
  "auth/popup-blocked": "Popup was blocked by the browser. Allow popups and try again.",
  "auth/account-exists-with-different-credential": "An account already exists with this email using a different sign-in method.",
  "auth/invalid-api-key": "Invalid Firebase API key. Check NEXT_PUBLIC_FIREBASE_API_KEY.",
  "permission-denied": "Permission denied by Firestore rules. Deploy the latest firestore.rules."
};
const err = (error: unknown) => {
  const code = (error as { code?: string })?.code || "";
  if (code && AUTH_MESSAGES[code]) return { message: AUTH_MESSAGES[code], code };
  return { message: error instanceof Error ? error.message : String(error), code };
};

async function createProfileIfMissing(user: any) {
  if (!firestore || !user) return;
  const profileRef = doc(firestore, "profiles", user.uid);
  const existing = await getDoc(profileRef);
  if (!existing.exists()) await setDoc(profileRef, {
    id: user.uid, email: user.email || "", display_name: user.displayName || "",
    bio: "", username: "", avatar_url: "", credits: 0, wallet_balance: 0,
    role: "user", status: "active", plan_name: "Free", plan_expires_at: null,
    referral_code: user.uid, signup_processed: false,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  });
}
// Dedupe concurrent calls (onAuthStateChanged + the sign-in handler both call this on first Google login;
// a second setDoc on an existing doc is an "update" and gets rejected by the rules).
const profileJobs = new Map<string, Promise<void>>();
function ensureProfile(user: any): Promise<void> {
  if (!firestore || !user) return Promise.resolve();
  let job = profileJobs.get(user.uid);
  if (!job) {
    job = createProfileIfMissing(user).finally(() => { profileJobs.delete(user.uid); });
    profileJobs.set(user.uid, job);
  }
  return job;
}
async function applySignupRewards(user: any) {
  if (!user) return;
  try {
    const token = await user.getIdToken();
    const response = await fetch("/api/firebase/signup", { method: "POST", headers: { Authorization: "Bearer " + token } });
    if (response.ok) await user.getIdToken(true); // Refresh custom admin claims assigned by the server.
  } catch {}
}
// Admin panel: make sure the Firebase `admin` custom claim matches the Firestore profile role
// (and the admin email allowlist) before the panel checks it. Only runs on /admin, once per account.
const adminSyncs = new Map<string, Promise<void>>();
function syncAdminClaim(user: any): Promise<void> {
  if (typeof window === "undefined" || !window.location.pathname.startsWith("/admin")) return Promise.resolve();
  let job = adminSyncs.get(user.uid);
  if (!job) {
    job = (async () => {
      try {
        const token = await user.getIdToken();
        const r = await fetch("/api/admin/session", { method: "POST", headers: { Authorization: "Bearer " + token } });
        const j = await r.json().catch(() => ({}));
        if (j.refreshed) await user.getIdToken(true);
      } catch {}
    })();
    adminSyncs.set(user.uid, job);
  }
  return job;
}
const authUser = (user: any) => user ? ({
  id: user.uid, uid: user.uid, email: user.email, email_confirmed_at: user.emailVerified ? new Date().toISOString() : null,
  user_metadata: { name: user.displayName || "" }, getIdToken: () => user.getIdToken(), getIdTokenResult: () => user.getIdTokenResult()
}) : null;

class QueryBuilder {
  table: string; filters: any[] = []; supabaseFilters: {field:string;op:"eq"|"neq"|"in"|"ilike";value:any}[] = []; sortSpec: { field: string; dir: "asc" | "desc" }[] = []; max = 0; action = "select";
  payload: AnyRow | AnyRow[] = {}; columns = "*"; opts: any = {}; idEq = "";
  constructor(table: string) { this.table = table; }
  select(columns = "*", opts: any = {}) { this.columns = columns; this.opts = opts; return this; }
  // eq("id", x) reads the document by its id, so it works even if the stored doc has no `id` field.
  eq(field: string, value: any) { if (field === "id") this.idEq = String(value); else this.filters.push(where(field, "==", value)); this.supabaseFilters.push({field,op:"eq",value}); return this; }
  neq(field: string, value: any) { this.filters.push(where(field, "!=", value)); this.supabaseFilters.push({field,op:"neq",value}); return this; }
  in(field: string, values: any[]) { this.filters.push(where(field, "in", values)); this.supabaseFilters.push({field,op:"in",value:values}); return this; }
  ilike(field: string, value: string) { this.filters.push({ field, value: value.replaceAll("%", "").toLowerCase(), ilike: true }); this.supabaseFilters.push({field,op:"ilike",value}); return this; }
  // Sorting is done in the browser so documents that lack the sort field are not silently dropped
  // and no composite Firestore index is required.
  order(field: string, options: any = {}) { this.sortSpec.push({ field, dir: options.ascending === false ? "desc" : "asc" }); return this; }
  limit(value: number) { this.max = value; return this; }
  insert(value: AnyRow | AnyRow[]) { this.action = "insert"; this.payload = value; return this; }
  upsert(value: AnyRow | AnyRow[], options?: any) { this.action = "upsert"; this.payload = value; this.opts = {...this.opts,...options}; return this; }
  update(value: AnyRow) { this.action = "update"; this.payload = value; return this; }
  delete() { this.action = "delete"; return this; }
  async executeSupabase() {
    try {
      const user = firebaseAuth?.currentUser;
      if (!user) throw new Error("Sign in to continue.");
      const token = await user.getIdToken();
      const response = await fetch("/api/supabase/data", {
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},
        body:JSON.stringify({
          table:this.table,action:this.action,columns:this.columns,filters:[...this.supabaseFilters,...(this.idEq?[{field:"id",op:"eq",value:this.idEq}]:[])],
          order:this.sortSpec,limit:this.max,opts:this.opts,payload:this.payload
        })
      });
      const body = await response.json().catch(()=>({error:{message:"Invalid server response."}}));
      if (!response.ok || body.error) return {data:null,count:body.count??null,error:body.error||{message:"Supabase request failed."}};
      return {data:body.data??null,count:body.count??undefined,error:null};
    } catch (e) { return {data:null,count:null,error:err(e)}; }
  }
  async execute() {
    if (this.table === "tools" || this.table === "site_settings") return this.executeSupabase();
    if (!firestore || !firebaseAuth?.currentUser) return { data: null, error: { message: "Firebase is not configured or you are signed out." } };
    try {
      const col = collection(firestore, this.table);
      if (this.action === "insert" || this.action === "upsert") {
        const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
        const output = [];
        for (const row of rows) {
          const id = String(row.id || (this.table === "profiles" ? firebaseAuth.currentUser.uid : row.key || crypto.randomUUID()));
          const stamped = this.action === "insert" && row.created_at === undefined ? { created_at: new Date().toISOString(), ...row } : row;
          await setDoc(doc(firestore, this.table, id), { ...stamped, id }, { merge: this.action === "upsert" });
          output.push({ ...stamped, id });
        }
        return { data: Array.isArray(this.payload) ? output : output[0], error: null };
      }
      const serverFilters = this.filters.filter(x => !x.ilike);
      const hasIlike = this.filters.some(x => x.ilike);
      const clientPage = this.sortSpec.length > 0 || hasIlike;
      let docs: AnyRow[];
      if (this.idEq && serverFilters.length === 0) {
        const one = await getDoc(doc(firestore, this.table, this.idEq));
        docs = one.exists() ? [{ id: one.id, ...one.data() } as AnyRow] : [];
      } else {
        const q = fsQuery(col, ...serverFilters, ...(!clientPage && this.max ? [fsLimit(this.max)] : []));
        const snapshot = await getDocs(q);
        docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AnyRow));
        if (this.idEq) docs = docs.filter(row => String(row.id) === this.idEq);
      }
      for (const filter of this.filters.filter(x => x.ilike)) docs = docs.filter(row => String(row[filter.field] || "").toLowerCase().includes(filter.value));
      if (this.sortSpec.length) docs.sort((a, b) => {
        for (const s of this.sortSpec) {
          const av = a[s.field], bv = b[s.field];
          if (av == null && bv == null) continue;
          if (av == null) return 1;
          if (bv == null) return -1;
          if (av === bv) continue;
          const c = av > bv ? 1 : -1;
          return s.dir === "asc" ? c : -c;
        }
        return 0;
      });
      if (clientPage && this.max) docs = docs.slice(0, this.max);
      if (this.action === "select") {
        if (this.opts.head) return { data: null, count: docs.length, error: null };
        if (this.columns !== "*") {
          const fields = this.columns.split(",").map((x: string) => x.trim());
          docs = docs.map(row => Object.fromEntries(fields.filter((f: string) => f in row).map((f: string) => [f, row[f]])));
        }
        return { data: docs, count: this.opts.count ? docs.length : undefined, error: null };
      }
      if (this.action === "update" || this.action === "delete") {
        for (const row of docs) {
          const id = String(row.id);
          if (this.action === "delete") await deleteDoc(doc(firestore, this.table, id));
          else await updateDoc(doc(firestore, this.table, id), this.payload as AnyRow);
        }
        return { data: null, error: null };
      }
      return { data: docs, error: null };
    } catch (e) { return { data: null, error: err(e) }; }
  }
  maybeSingle() { return this.execute().then((r: any) => ({ ...r, data: Array.isArray(r.data) ? r.data[0] || null : r.data })); }
  then(resolve: any, reject: any) { return this.execute().then(resolve, reject); }
}
export function createClient(_url?: string, _key?: string) {
  const configured = firebaseConfigured() && firestore && firebaseAuth;
  const client: any = {
    from: (table: string) => new QueryBuilder(table),
    auth: {
      getUser: async () => {
        const u = firebaseAuth?.currentUser;
        if (u) await syncAdminClaim(u);
        return { data: { user: authUser(u) }, error: null };
      },
      getSession: async () => {
        // currentUser is null until Firebase restores the persisted session; wait for it once.
        if (firebaseAuth) await firebaseAuth.authStateReady();
        return { data: { session: firebaseAuth?.currentUser?.emailVerified ? { user: authUser(firebaseAuth.currentUser) } : null }, error: null };
      },
      onAuthStateChange: (_cb: any) => {
        const unsubscribe = firebaseAuth ? onAuthStateChanged(firebaseAuth, user => {
          if (!user || !user.emailVerified) { _cb("SIGNED_OUT", null); return; }
          void ensureProfile(user).then(() => applySignupRewards(user)).catch(() => {}).finally(() => _cb("SIGNED_IN", { user: authUser(user) }));
        }) : () => {};
        return { data: { subscription: { unsubscribe } } };
      },
      signOut: async () => {
        try {
          const current=firebaseAuth?.currentUser;
          if(current){
            try{
              const token=await current.getIdToken();
              await fetch("/api/admin/2fa",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({action:"logout"})});
            }catch{}
          }
          adminSyncs.clear();
          if (firebaseAuth) await signOut(firebaseAuth);
          return { error: null };
        } catch (e) { return { error: err(e) }; }
      },
      signInWithPassword: async ({ email, password }: any) => {
        try {
          if (!firebaseAuth) throw new Error("Firebase is not configured.");
          const c = await signInWithEmailAndPassword(firebaseAuth, email, password);
          if (!c.user.emailVerified) {
            let resent = false;
            try { await sendEmailVerification(c.user); resent = true; } catch {}
            await signOut(firebaseAuth);
            throw new Error("Email not confirmed. " + (resent ? "A new verification email was just sent. " : "") + "Verify the email sent by Firebase (check spam), then log in.");
          }
          await ensureProfile(c.user);
          await applySignupRewards(c.user);
          return { data: { user: authUser(c.user), session: { user: authUser(c.user) } }, error: null };
        } catch (e) { return { data: {}, error: err(e) }; }
      },
      signUp: async ({ email, password, options }: any) => {
        try {
          if (!firebaseAuth || !firestore) throw new Error("Firebase is not configured.");
          const c = await createUserWithEmailAndPassword(firebaseAuth, email, password);
          const name = options?.data?.name || "";
          if (name) await updateProfile(c.user, { displayName: name });
          await setDoc(doc(firestore, "profiles", c.user.uid), { id: c.user.uid, email, display_name: name, bio: "", username: "", avatar_url: "", credits: 0, wallet_balance: 0, role: "user", status: "active", plan_name: "Free", plan_expires_at: null, referral_code: c.user.uid, pending_referral_code: String(options?.data?.referral_code || "").trim(), signup_processed: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
          try { await sendEmailVerification(c.user); } catch {}
          await signOut(firebaseAuth);
          return { data: { user: authUser(c.user), session: null }, error: null };
        } catch (e) { return { data: {}, error: err(e) }; }
      },
      resetPasswordForEmail: async (email: string, _options?: any) => { try { if (!firebaseAuth) throw new Error("Firebase is not configured."); await sendPasswordResetEmail(firebaseAuth, email); return { error: null }; } catch (e) { return { error: err(e) }; } },
      signInWithOAuth: async ({ provider }: any) => {
        if (!firebaseAuth) return { error: { message: "Firebase is not configured." } };
        const p: any = provider === "github" ? new GithubAuthProvider() : new GoogleAuthProvider();
        if (provider !== "github") p.setCustomParameters({ prompt: "select_account" });
        try {
          const result = await signInWithPopup(firebaseAuth, p);
          if (!result.user.emailVerified) {
            await signOut(firebaseAuth);
            throw new Error("Your " + (provider === "github" ? "GitHub" : "Google") + " email is not verified. Verify it with the provider and try again.");
          }
          await ensureProfile(result.user);
          await applySignupRewards(result.user);
          const user = authUser(result.user);
          return { data: { user, session: { user } }, error: null };
        } catch (e) {
          const code = (e as { code?: string })?.code || "";
          if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return { error: null };
          if (code === "auth/popup-blocked") {
            // Popup blocked (common on mobile in-app browsers): fall back to a full-page redirect.
            try { await signInWithRedirect(firebaseAuth, p); return { error: null }; } catch (e2) { return { error: err(e2) }; }
          }
          return { error: err(e) };
        }
      }
    },
    storage: { from: (bucket: string) => ({
      upload: async (path: string, file: File, options: any = {}) => {
        try {
          const user=firebaseAuth?.currentUser;if(!user)throw new Error("Sign in to upload an image.");
          const token=await user.getIdToken();const form=new FormData();form.set("operation","upload");form.set("bucket",bucket);form.set("path",path);form.set("file",file);form.set("upsert",String(Boolean(options.upsert)));
          const response=await fetch("/api/supabase/storage",{method:"POST",headers:{Authorization:"Bearer "+token},body:form});
          const body=await response.json().catch(()=>({error:"Invalid storage response."}));if(!response.ok)throw new Error(body.error||"Image upload failed.");
          return {data:body.data,error:null};
        } catch(e){return {data:null,error:err(e)};}
      },
      createSignedUrl: async (path: string, expiresIn=3600) => {
        try {
          const user=firebaseAuth?.currentUser;if(!user)throw new Error("Sign in to view this image.");
          const token=await user.getIdToken();const form=new FormData();form.set("operation","signed-url");form.set("bucket",bucket);form.set("path",path);form.set("expiresIn",String(expiresIn));
          const response=await fetch("/api/supabase/storage",{method:"POST",headers:{Authorization:"Bearer "+token},body:form});
          const body=await response.json().catch(()=>({error:"Invalid storage response."}));if(!response.ok)throw new Error(body.error||"Could not create image URL.");
          return {data:body.data,error:null};
        } catch(e){
          // Read-only compatibility fallback for files uploaded before the move.
          // All new uploads are sent to Supabase Storage.
          try {
            if(firebaseStorage && (bucket==="cyberx-avatars" || bucket==="cyberx-user-media")) {
              return {data:{signedUrl:await getDownloadURL(ref(firebaseStorage,bucket+"/"+path))},error:null};
            }
          } catch {}
          return {data:null,error:err(e)};
        }
      }
    }) },
    rpc: async (name: string, args: AnyRow = {}) => {
      try {
        const user = firebaseAuth?.currentUser; if (!user) throw new Error("Please sign in.");
        const token = await user.getIdToken();
        const response = await fetch("/api/firebase/rpc", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ name, args }) });
        const body = await response.json(); if (!response.ok) throw new Error(body.error || "Request failed.");
        return { data: body.data, error: null };
      } catch (e) { return { data: null, error: err(e) }; }
    },
    functions: { invoke: async (name: string, options: any) => {
      try { const user = firebaseAuth?.currentUser; if (!user) throw new Error("Please sign in."); const token = await user.getIdToken(); const response = await fetch(name === "run-custom-tool" ? "/api/tools/run" : "/api/firebase/rpc", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify(name === "run-custom-tool" ? options.body : { name, args: options.body }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Request failed."); return { data, error: null }; } catch (e) { return { data: null, error: err(e) }; }
    } },
    channel: () => ({ on: (_event: any, _filter: any, callback: any) => ({ subscribe: () => {
      const uid = firebaseAuth?.currentUser?.uid; if (!firestore || !uid) return { unsubscribe: () => {} };
      const stop = onSnapshot(doc(firestore, "profiles", uid), snap => callback({ new: snap.data() || {} }));
      return { unsubscribe: stop };
    } }) }),
    removeChannel: async (channel: any) => { channel?.unsubscribe?.(); }
  };
  if (!configured) return null;
  return client;
}
