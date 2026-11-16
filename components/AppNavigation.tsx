"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {Home,Search,LayoutDashboard,Wallet,UserRound, Megaphone,Mail,ShieldCheck} from "lucide-react";
const items=[
 {href:"/",label:"Home",Icon:Home},
 {href:"/tools",label:"Tools",Icon:Search},
 {href:"/dashboard",label:"Dashboard",Icon:LayoutDashboard},
 {href:"/credits",label:"Credits",Icon:Wallet},
 {href:"/profile",label:"Profile",Icon:UserRound},
 {href:"/announcements",label:"Updates",Icon:Megaphone},
 {href:"/contact",label:"Contact",Icon:Mail}
];
export default function AppNavigation(){
 const path=usePathname();
 if(path==="/"||path.startsWith("/login")||path.startsWith("/register")||path.startsWith("/forgot-password")||path.startsWith("/reset-password")) return null;
 return <nav className="app-navigation" aria-label="Main navigation">
  <Link href="/" className="app-nav-brand"><span className="logo"><ShieldCheck size={19}/></span><span>CyberX <em>OSINT</em></span></Link>
  <div className="app-nav-links">{items.map(({href,label,Icon})=><Link key={href} href={href} className={path===href||(href!=="/"&&path.startsWith(href+"/"))?"active":""}><Icon size={17}/><span>{label}</span></Link>)}</div>
 </nav>;
}
