"use client";

import { firebaseAuth, firestore, firebaseStorage, firebaseConfigured } from "./client";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, sendPasswordResetEmail, sendEmailVerification,
  updateProfile, GoogleAuthProvider, GithubAuthProvider, signInWithPopup
} from "firebase/auth";
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query as fsQuery, where, orderBy, limit as fsLimit, onSnapshot
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

type AnyRow = Record<string, any>;
const err = (error: unknown) => ({ message: error instanceof Error ? error.message : String(error) });
async function ensureProfile(user: any) {
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
async function applySignupRewards(user: any) {
  if (!user) return;
  const token = await user.getIdToken();
  await fetch("/api/firebase/signup", { method: "POST", headers: { Authorization: "Bearer " + token } });
}
const authUser = (user: any) => user ? ({
  id: user.uid, uid: user.uid, email: user.email, email_confirmed_at: user.emailVerified ? new Date().toISOString() : null,
  user_metadata: { name: user.displayName || "" }, getIdToken: () => user.getIdToken()
}) : null;

class QueryBuilder {
  table: string; filters: any[] = []; sort: any[] = []; max = 0; action = "select";
  payload: AnyRow | AnyRow[] = {}; columns = "*"; opts: any = {};
  constructor(table: string) { this.table = table; }
  select(columns = "*", opts: any = {}) { this.columns = columns; this.opts = opts; return this; }
  eq(field: string, value: any) { this.filters.push(where(field, "==", value)); return this; }
  neq(field: string, value: any) { this.filters.push(where(field, "!=", value)); return this; }
  in(field: string, values: any[]) { this.filters.push(where(field, "in", values)); return this; }
  ilike(field: string, value: string) { this.filters.push({ field, value: value.replaceAll("%", "").toLowerCase(), ilike: true }); return this; }
  order(field: string, options: any = {}) { this.sort.push(orderBy(field, options.ascending === false ? "desc" : "asc")); return this; }
  limit(value: number) { this.max = value; return this; }
  insert(value: AnyRow | AnyRow[]) { this.action = "insert"; this.payload = value; return this; }
  upsert(value: AnyRow | AnyRow[], _options?: any) { this.action = "upsert"; this.payload = value; return this; }
  update(value: AnyRow) { this.action = "update"; this.payload = value; return this; }
  delete() { this.action = "delete"; return this; }
  async execute() {
    if (!firestore || !firebaseAuth?.currentUser) return { data: null, error: { message: "Firebase is not configured or you are signed out." } };
    try {
      const col = collection(firestore, this.table);
      const q = fsQuery(col, ...this.filters.filter(x => !x.ilike), ...this.sort, ...(this.max ? [fsLimit(this.max)] : []));
      if (this.action === "insert" || this.action === "upsert") {
        const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
        const output = [];
        for (const row of rows) {
          const id = String(row.id || (this.table === "profiles" ? firebaseAuth.currentUser.uid : row.key || crypto.randomUUID()));
          await setDoc(doc(firestore, this.table, id), { ...row, id }, { merge: this.action === "upsert" });
          output.push({ ...row, id });
        }
        return { data: Array.isArray(this.payload) ? output : output[0], error: null };
      }
      let snapshot = await getDocs(q);
      let docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AnyRow));
      for (const filter of this.filters.filter(x => x.ilike)) docs = docs.filter(row => String(row[filter.field] || "").toLowerCase().includes(filter.value));
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
      getUser: async () => ({ data: { user: authUser(firebaseAuth?.currentUser) }, error: null }),
      getSession: async () => ({ data: { session: firebaseAuth?.currentUser ? { user: authUser(firebaseAuth.currentUser) } : null }, error: null }),
      onAuthStateChange: (_cb: any) => {
        const unsubscribe = firebaseAuth ? onAuthStateChanged(firebaseAuth, user => _cb(user ? "SIGNED_IN" : "SIGNED_OUT", user ? { user: authUser(user) } : null)) : () => {};
        return { data: { subscription: { unsubscribe } } };
      },
      signOut: async () => { try { if (firebaseAuth) await signOut(firebaseAuth); return { error: null }; } catch (e) { return { error: err(e) }; } },
      signInWithPassword: async ({ email, password }: any) => {
        try {
          if (!firebaseAuth) throw new Error("Firebase is not configured.");
          const c = await signInWithEmailAndPassword(firebaseAuth, email, password);
          if (!c.user.emailVerified) { await signOut(firebaseAuth); throw new Error("Email not confirmed. Verify the email sent by Firebase before logging in."); }
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
        try { if (!firebaseAuth) throw new Error("Firebase is not configured."); const p = provider === "github" ? new GithubAuthProvider() : new GoogleAuthProvider(); const result = await signInWithPopup(firebaseAuth, p); await ensureProfile(result.user); await applySignupRewards(result.user); return { error: null }; } catch (e) { return { error: err(e) }; }
      }
    },
    storage: { from: (bucket: string) => ({
      upload: async (path: string, file: File, options: any = {}) => { try { if (!firebaseStorage) throw new Error("Firebase Storage is not configured."); await uploadBytes(ref(firebaseStorage, bucket + "/" + path), file, { contentType: options.contentType || file.type }); return { error: null }; } catch (e) { return { error: err(e) }; } },
      createSignedUrl: async (path: string) => { try { if (!firebaseStorage) throw new Error("Firebase Storage is not configured."); return { data: { signedUrl: await getDownloadURL(ref(firebaseStorage, bucket + "/" + path)) }, error: null }; } catch (e) { return { data: null, error: err(e) }; } }
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
