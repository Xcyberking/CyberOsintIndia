import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';

export const revalidate = 60;

export default async function Announcements() {
  let data: any[] = [];
  try {
    const res = await createPublicClient().from('announcements').select('id,title,body,created_at').eq('active', true).order('created_at', { ascending: false }).limit(30);
    data = res.data || [];
  } catch {
    data = [];
  }
  return (
    <main className='panel-page'>
      <Link href='/'>← Home</Link>
      <span className='eyebrow'>Updates</span>
      <h1>Announcements</h1>
      {data.map((a) => (
        <article className='card announcement' key={a.id}><div><b>{a.title}</b><p>{a.body}</p><small>{new Date(a.created_at).toLocaleString()}</small></div></article>
      ))}
      {!data.length && <p className='empty' style={{ marginTop: 22 }}>No announcements currently.</p>}
    </main>
  );
}
