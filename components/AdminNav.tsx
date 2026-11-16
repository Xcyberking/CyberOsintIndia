'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Wrench, Activity, Gift, Settings, HeartPulse } from 'lucide-react';

const items = [
  { href: '/admin', label: 'Overview', Icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', Icon: Users },
  { href: '/admin/tools', label: 'Tools', Icon: Wrench },
  { href: '/admin/activity', label: 'Activity', Icon: Activity },
  { href: '/admin/referrals', label: 'Referrals', Icon: Gift },
  { href: '/admin/settings', label: 'Settings', Icon: Settings },
  { href: '/admin/health', label: 'Health', Icon: HeartPulse },
];

export default function AdminNav() {
  const path = usePathname() || '/admin';
  return (
    <nav className='admin-bar' aria-label='Admin navigation'>
      {items.map(({ href, label, Icon }) => {
        const active = href === '/admin' ? path === '/admin' : path === href || path.startsWith(href + '/');
        return <Link key={href} href={href} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}><Icon /><span>{label}</span></Link>;
      })}
    </nav>
  );
}
