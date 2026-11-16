'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { Home, Search, LayoutDashboard, Wallet, UserRound, Megaphone, Mail, ShieldCheck } from 'lucide-react';

// Loaded after first paint so the Supabase browser client never blocks rendering.
const AuthActions = dynamic(() => import('./AuthActions'), { ssr: false, loading: () => <span style={{ minWidth: 120, display: 'inline-block' }} /> });

const items = [
  { href: '/', label: 'Home', Icon: Home },
  { href: '/tools', label: 'Tools', Icon: Search },
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/credits', label: 'Credits', Icon: Wallet },
  { href: '/profile', label: 'Profile', Icon: UserRound },
  { href: '/announcements', label: 'Updates', Icon: Megaphone },
  { href: '/contact', label: 'Contact', Icon: Mail },
];
const HIDDEN = /^[/](login|register|forgot-password|reset-password|admin)([/]|$)/;

export default function AppNavigation() {
  const path = usePathname() || '/';
  if (HIDDEN.test(path)) return null;
  return (
    <nav className='app-navigation' aria-label='Main navigation'>
      <Link href='/' className='app-nav-brand'><span className='logo'><ShieldCheck size={19} /></span><span>CyberX <em>OSINT</em></span></Link>
      <div className='app-nav-links'>
        {items.map(({ href, label, Icon }) => {
          const active = path === href || (href !== '/' && path.startsWith(href + '/'));
          return <Link key={href} href={href} title={label} className={active ? 'active' : ''}><Icon size={17} /><span>{label}</span></Link>;
        })}
      </div>
      <div className='nav-auth'><AuthActions /></div>
    </nav>
  );
}
