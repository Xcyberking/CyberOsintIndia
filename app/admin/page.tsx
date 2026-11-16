import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';

export default async function Admin() {
  const { supabase } = await requireAdmin();
  const [users, searches, tools, apis, recent] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('search_history').select('id', { count: 'exact', head: true }),
    supabase.from('tools').select('slug', { count: 'exact', head: true }).eq('enabled', true),
    supabase.from('tool_apis').select('slug', { count: 'exact', head: true }),
    supabase.from('profiles').select('id,email,display_name,role,credits,created_at').order('created_at', { ascending: false }).limit(6),
  ]);
  return (
    <main className='panel-page'>
      <span className='eyebrow'>Control center</span>
      <h1>Admin overview</h1>
      <p>Use the bar at the bottom to jump between Users, Tools, Activity, Referrals, Settings and Health.</p>
      <div className='stats'>
        <article><small>USERS</small><b>{users.count ?? 0}</b></article>
        <article><small>SEARCHES</small><b>{searches.count ?? 0}</b></article>
        <article><small>LIVE TOOLS</small><b>{tools.count ?? 0}</b></article>
        <article><small>API CONNECTIONS</small><b>{apis.count ?? 0}</b></article>
      </div>
      <div className='panel-links'><Link href='/admin/tools'>Add or edit tools →</Link><Link href='/admin/users'>Manage users →</Link></div>
      <h2>Newest users</h2>
      <div className='table-wrap'><table><thead><tr><th>User</th><th>Role</th><th>Credits</th><th>Joined</th></tr></thead><tbody>
        {recent.data?.map((u) => <tr key={u.id}><td><b>{u.display_name || '-'}</b><br /><small>{u.email}</small></td><td>{u.role}</td><td>{u.credits}</td><td>{new Date(u.created_at).toLocaleDateString()}</td></tr>)}
        {!recent.data?.length && <tr><td colSpan={4}>No users yet.</td></tr>}
      </tbody></table></div>
    </main>
  );
}
