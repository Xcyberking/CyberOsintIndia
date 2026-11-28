import { NextResponse } from "next/server";
import { createHash, randomInt, randomBytes } from "node:crypto";
import { adminDb, adminAuth, verifyBearer } from "@/lib/firebase/admin";

export const runtime = "nodejs";
const hash=(value:string)=>createHash("sha256").update(value).digest("hex");
const cookieName="cx_admin_verified";
const identity=async(request:Request)=>{
  const decoded=await verifyBearer(request);
  const user=await adminAuth().getUser(decoded.uid);
  if(user.customClaims?.admin!==true) throw new Error("Administrator permission required.");
  const profile=await adminDb().collection("profiles").doc(decoded.uid).get();
  if(!profile.exists||profile.data()?.role!=="admin"||profile.data()?.status!=="active") throw new Error("Active administrator profile required.");
  return {decoded,profile:profile.data()||{}};
};
const currentSession=async(request:Request,uid:string)=>{
  const token=request.headers.get("cookie")?.split(";").map(x=>x.trim()).find(x=>x.startsWith(cookieName+"="))?.slice(cookieName.length+1);
  if(!token)return false;
  const snap=await adminDb().collection("admin_2fa_sessions").doc(hash(token)).get();
  const data=snap.data();
  return Boolean(snap.exists&&data?.uid===uid&&Number(data.expiresAt)>Date.now());
};
const issueSession=async(uid:string)=>{
  const token=randomBytes(32).toString("hex");
  const expiresAt=Date.now()+24*60*60*1000;
  await adminDb().collection("admin_2fa_sessions").doc(hash(token)).set({uid,createdAt:Date.now(),expiresAt});
  return {token,expiresAt};
};
const setCookie=(response:NextResponse,token:string)=>{
  response.cookies.set(cookieName,token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:86400});
};
const maskedIp=(request:Request)=>{
  const raw=(request.headers.get("x-forwarded-for")||"").split(",")[0].trim();
  if(!raw)return "Unavailable";
  if(raw.includes(":"))return raw.split(":").slice(0,4).join(":")+"::";
  const p=raw.split(".");return p.length===4?p.slice(0,3).join(".")+".xxx":"Unavailable";
};
export async function GET(request:Request){
  try{
    const {decoded}=await identity(request);
    const settingsSnap=await adminDb().collection("admin_security").doc("settings").get();
    const settings=settingsSnap.data()||{};
    const enabled=settings.enabled===true;
    const verified=await currentSession(request,decoded.uid);
    return NextResponse.json({enabled,verified,expiresIn:verified?86400:0,botConfigured:Boolean(settings.botToken&&settings.chatId)});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Not authorized."},{status:403});}
}
export async function POST(request:Request){
  try{
    const {decoded,profile}=await identity(request);
    const body=await request.json();
    const db=adminDb();
    const settingsRef=db.collection("admin_security").doc("settings");
    const settingsSnap=await settingsRef.get();
    const settings=settingsSnap.data()||{};
    if(body.action==="settings"){
      if(settings.enabled===true&&!await currentSession(request,decoded.uid))throw new Error("Verify the current Telegram OTP before changing security settings.");
      const botToken=String(body.botToken||"").trim();
      const chatId=String(body.chatId||"").trim();
      const enabled=body.enabled===true;
      if(enabled&&!(botToken||settings.botToken)&&!(chatId||settings.chatId))throw new Error("Add the Telegram bot token and Admin chat ID before enabling 2FA.");
      if(enabled&&!(botToken||settings.botToken))throw new Error("Telegram bot token is required.");
      if(enabled&&!(chatId||settings.chatId))throw new Error("Admin Telegram chat ID is required.");
      await settingsRef.set({botToken:botToken||settings.botToken||"",chatId:chatId||settings.chatId||"",enabled,updatedAt:Date.now(),updatedBy:decoded.uid},{merge:true});
      return NextResponse.json({ok:true,enabled,botConfigured:Boolean(botToken||settings.botToken),chatConfigured:Boolean(chatId||settings.chatId)});
    }
    if(body.action==="start"){
      if(settings.enabled!==true){
        const issued=await issueSession(decoded.uid);const response=NextResponse.json({ok:true,required:false,expiresAt:issued.expiresAt});setCookie(response,issued.token);return response;
      }
      if(!settings.botToken||!settings.chatId)throw new Error("Telegram 2FA is enabled but the bot token or chat ID is missing. Ask the site administrator to configure it.");
      const otp=String(randomInt(100000,1000000));
      const challengeId=randomBytes(20).toString("hex");
      await db.collection("admin_2fa_challenges").doc(challengeId).set({uid:decoded.uid,otpHash:hash(otp),attempts:0,expiresAt:Date.now()+5*60*1000,createdAt:Date.now()});
      const name=String(profile.display_name||decoded.name||decoded.email||"Admin").slice(0,80);
      const message="CyberX OSINT Admin Login\nWebsite: "+(process.env.NEXT_PUBLIC_SITE_NAME||"CyberX OSINT")+"\nAdmin: "+name+"\nIP: "+maskedIp(request)+"\nOTP: "+otp+"\nValid for 5 minutes. Never share this code.";
      const tg=await fetch("https://api.telegram.org/bot"+settings.botToken+"/sendMessage",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:settings.chatId,text:message}),signal:AbortSignal.timeout(10000)});
      const tgBody=await tg.json().catch(()=>({}));
      if(!tg.ok||tgBody.ok!==true){await db.collection("admin_2fa_challenges").doc(challengeId).delete();throw new Error("Telegram OTP could not be delivered. Check bot token, chat ID and ensure the bot has been started.");}
      return NextResponse.json({ok:true,required:true,challengeId,expiresIn:300});
    }
    if(body.action==="verify"){
      const challengeId=String(body.challengeId||"");
      const otp=String(body.otp||"").trim();
      if(!/^[a-f0-9]{40}$/.test(challengeId)||!/^\d{6}$/.test(otp))throw new Error("Enter the six-digit Telegram OTP.");
      const ref=db.collection("admin_2fa_challenges").doc(challengeId);
      let valid=false;
      await db.runTransaction(async tx=>{
        const snap=await tx.get(ref);const data=snap.data();
        if(!snap.exists||data?.uid!==decoded.uid||Number(data.expiresAt)<Date.now()||Number(data.attempts)>=5)throw new Error("OTP expired or too many attempts. Login again for a new code.");
        if(data.otpHash!==hash(otp)){tx.update(ref,{attempts:Number(data.attempts||0)+1});return;}
        tx.delete(ref);valid=true;
      });
      if(!valid)throw new Error("Incorrect OTP. Please check the Telegram message.");
      const issued=await issueSession(decoded.uid);const response=NextResponse.json({ok:true,verified:true,expiresAt:issued.expiresAt});setCookie(response,issued.token);return response;
    }
    if(body.action==="logout"){
      const token=request.headers.get("cookie")?.split(";").map(x=>x.trim()).find(x=>x.startsWith(cookieName+"="))?.slice(cookieName.length+1);
      if(token)await db.collection("admin_2fa_sessions").doc(hash(token)).delete().catch(()=>{});
      const response=NextResponse.json({ok:true});response.cookies.set(cookieName,"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:0});return response;
    }
    throw new Error("Unsupported security action.");
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Security action failed."},{status:400});}
}
