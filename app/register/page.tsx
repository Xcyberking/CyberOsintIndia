import Link from "next/link";
import {redirect} from "next/navigation";
import {signUp} from "@/app/auth/actions";
import {createClient} from "@/lib/supabase/server";

export default async function Register({searchParams}:{searchParams:Promise<{error?:string;ref?:string}>}){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(user)redirect("/dashboard");
 const q=await searchParams;
 const referralCode=(q.ref||"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8);
 return <main className="auth-page"><form action={signUp} className="auth-card">
  <Link href="/" className="back">← CyberX OSINT</Link><span className="eyebrow">CREATE YOUR WORKSPACE</span><h1>Register</h1>
  <p>Start with 5 complimentary credits. Use a friend’s referral link to receive 10 bonus credits after email verification.</p>
  {q.error&&<div className="error">{q.error}</div>}
  <label>Display name<input name="name" required maxLength={60}/></label>
  <label>Email<input name="email" type="email" required autoComplete="email"/></label>
  <label>Referral code (optional)<input name="referral_code" maxLength={8} autoCapitalize="characters" defaultValue={referralCode} placeholder="Enter your friend's code"/></label>
  <label>Password<input name="password" type="password" minLength={8} required autoComplete="new-password"/></label>
  <button className="primary" type="submit">Create account</button>
  <small>Already registered? <Link href="/login">Login</Link></small>
 </form></main>;
}