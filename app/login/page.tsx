import Link from "next/link";
import {signIn,signInWithGoogle} from "@/app/auth/actions";
export default async function Login({searchParams}:{searchParams:Promise<{error?:string;message?:string}>}){
 const q=await searchParams;
 return <main className="auth-page"><div className="auth-card">
  <Link href="/" className="back">← CyberX OSINT</Link>
  <span className="eyebrow">WELCOME BACK</span><h1>Sign in</h1><p>Access your research workspace.</p>
  {q.error&&<div className="error">{q.error}</div>}{q.message&&<div className="success">{q.message}</div>}
  <form action={signIn} style={{display:"grid",gap:15}}>
   <label>Email<input name="email" type="email" required autoComplete="email"/></label>
   <label>Password<input name="password" type="password" required autoComplete="current-password"/></label>
   <button className="primary" type="submit">Login to dashboard</button>
  </form>
  <Link href="/forgot-password" className="forgot">Forgot password?</Link>
  <form action={signInWithGoogle}><button className="ghost" type="submit">Continue with Google</button></form>
  <small>New here? <Link href="/register">Create an account</Link></small>
 </div></main>;
}
