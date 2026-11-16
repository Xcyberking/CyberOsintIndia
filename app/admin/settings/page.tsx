import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { saveContactSettings, createAnnouncement, updateAnnouncement, deleteAnnouncement } from './actions';

export default async function AdminSettings() {
  const { supabase } = await requireAdmin();
  const [{ data: contact }, { data: announcements }] = await Promise.all([
    supabase.from('site_settings').select('value').eq('key', 'contact').maybeSingle(),
    supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(30),
  ]);
  const c = contact?.value || {};
  return (
    <main className='panel-page'>
      <Link href='/admin'>← Overview</Link>
      <span className='eyebrow'>Site configuration</span>
      <h1>Settings</h1>
      <h2>Public contact links</h2>
      <form action={saveContactSettings} className='settings-form'>
        {(['email', 'telegram', 'whatsapp', 'github', 'instagram', 'youtube'] as const).map((k) => (
          <label key={k}>{k.toUpperCase()}<input name={k} type={k === 'email' ? 'email' : 'url'} defaultValue={c[k] || ''} placeholder={k === 'email' ? 'support@example.com' : 'https://...'} /></label>
        ))}
        <button className='primary'>Save contact links</button>
      </form>
      <h2>Announcements</h2>
      <form action={createAnnouncement} className='settings-form'>
        <label>Title<input name='title' maxLength={100} required /></label>
        <label>Message<textarea name='body' maxLength={2000} required rows={4} /></label>
        <button className='primary'>Publish announcement</button>
      </form>
      <div className='table-wrap'><table><thead><tr><th>Announcement</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {announcements?.map((a: any) => (
          <tr key={a.id}>
            <td><b>{a.title}</b><br /><small>{a.body}</small></td>
            <td>{a.active ? 'Active' : 'Hidden'}</td>
            <td>
              <form action={updateAnnouncement} className='inline-form'><input type='hidden' name='id' value={a.id} /><label className='check'><input type='checkbox' name='active' defaultChecked={a.active} /> Visible</label><button className='primary'>Save</button></form>
              <form action={deleteAnnouncement} style={{ marginTop: 8 }}><input type='hidden' name='id' value={a.id} /><button className='ghost'>Delete</button></form>
            </td>
          </tr>
        ))}
        {!announcements?.length && <tr><td colSpan={3}>No announcements yet.</td></tr>}
      </tbody></table></div>
      <p className='muted' style={{ marginTop: 18 }}>Payments are not activated in this release. Credits are added by admins or through referrals.</p>
    </main>
  );
}
