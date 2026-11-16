"use client";
import {useState} from "react";
import {Copy,Share2,Send,Check,Instagram,Facebook} from "lucide-react";

export default function ReferralShare({code,link}:{code:string;link:string}){
 const [copied,setCopied]=useState(false);
 const message="Join me on CyberX OSINT! Create your free account using my referral link. You get 10 bonus credits and I get 5 credits after your email is verified and you sign in.";
 const shareText=message+" "+link;
 const encUrl=encodeURIComponent(link);
 const encText=encodeURIComponent(message);
 async function copyLink(){
  try{await navigator.clipboard.writeText(link);setCopied(true);setTimeout(()=>setCopied(false),2200);}
  catch{window.prompt("Copy your referral link:",link);}
 }
 async function nativeShare(){
  if(navigator.share){try{await navigator.share({title:"Join CyberX OSINT",text:message,url:link});}catch{}}
  else await copyLink();
 }
 return <section className="referral-box">
  <div className="referral-heading"><span className="eyebrow">INVITE FRIENDS • EARN CREDITS</span><h2>Your referral link</h2></div>
  <p>Share this link with friends. When a new user registers, verifies email and signs in, they get <b>10 credits</b> and you get <b>5 credits</b>.</p>
  <div className="referral-code-row"><span>Your code</span><b>{code}</b></div>
  <label className="referral-link-label">Personal invite link<input readOnly value={link}/></label>
  <div className="referral-actions">
   <button className="primary" type="button" onClick={copyLink}>{copied?<Check size={16}/>:<Copy size={16}/>} {copied?"Copied":"Copy link"}</button>
   <a className="share-button whatsapp" target="_blank" rel="noreferrer" href={"https://wa.me/?text="+encodeURIComponent(shareText)}>WhatsApp</a>
   <a className="share-button telegram" target="_blank" rel="noreferrer" href={"https://t.me/share/url?url="+encUrl+"&text="+encText}><Send size={15}/> Telegram</a>
   <a className="share-button facebook" target="_blank" rel="noreferrer" href={"https://www.facebook.com/sharer/sharer.php?u="+encUrl}><Facebook size={15}/> Facebook</a>
   <button className="share-button instagram" type="button" onClick={nativeShare}><Instagram size={15}/> Instagram / More</button>
  </div>
  <small className="muted">Instagram and other apps open through your phone’s share menu when supported. Rewards are credited only once per referred account. Self-referrals are not allowed.</small>
 </section>;
}
