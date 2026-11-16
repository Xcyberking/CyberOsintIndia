import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import AdminNav from '@/components/AdminNav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className='admin-shell'>
      <header className='admin-top'>
        <Link href='/admin' className='app-nav-brand'><span className='logo'><ShieldCheck size={19} /></span><span>CyberX <em>Admin</em></span></Link>
        <span className='spacer' />
        <Link href='/dashboard' className='ghost'>Exit admin</Link>
      </header>
      <div className='admin-main'>{children}</div>
      <AdminNav />
    </div>
  );
}
