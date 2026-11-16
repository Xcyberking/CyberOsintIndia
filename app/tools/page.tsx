import Link from 'next/link';
import { Wrench } from 'lucide-react';
import { createPublicClient } from '@/lib/supabase/public';

export const revalidate = 60;

export default async function Tools() {
  let tools: any[] = [];
  try {
    const { data } = await createPublicClient().from('tools').select('slug,name,description,category,credit_cost').eq('enabled', true).order('created_at', { ascending: false });
    tools = data || [];
  } catch {
    tools = [];
  }
  return (
    <main className='panel-page'>
      <Link href='/'>← Home</Link>
      <span className='eyebrow'>Research tools</span>
      <h1>Tools</h1>
      <p>Choose a tool to start a lookup. Credits are charged per search and refunded automatically if a lookup fails.</p>
      {tools.length ? (
        <div className='grid' style={{ marginTop: 22 }}>
          {tools.map((t) => (
            <Link href={'/tools/' + t.slug} className='card' key={t.slug}>
              <span className='icon'><Wrench size={20} /></span>
              <span><b>{t.name}</b><small>{t.description || t.category}</small><span className='meta'>{t.category} · {t.credit_cost} credit{t.credit_cost === 1 ? '' : 's'}</span></span>
            </Link>
          ))}
        </div>
      ) : (
        <p className='empty' style={{ marginTop: 22 }}>No tools have been published yet.</p>
      )}
    </main>
  );
}
