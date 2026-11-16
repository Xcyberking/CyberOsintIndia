import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';

export const revalidate = 60;

export default async function ContactPage() {
  let c: Record<string, any> = {};
  try {
    const { data } = await createPublicClient().from('site_settings').select('value').eq('key', 'contact').maybeSingle();
    c = data?.value || {};
  } catch {
    c = {};
  }
  const entries = ([['Email', c.email], ['Telegram', c.telegram], ['WhatsApp', c.whatsapp], ['GitHub', c.github], ['Instagram', c.instagram], ['YouTube', c.youtube]] as [string, unknown][])
    .filter((x) => typeof x[1] === 'string' && x[1]) as [string, string][];
  return (
    <main className='panel-page'>
      <Link href='/'>← Home</Link>
      <span className='eyebrow'>Get in touch</span>
      <h1>Contact CyberX</h1>
      <p>Use the official contact channels below.</p>
      <div className='panel-links'>
        {entries.map(([name, value]) => (
          <a key={name} href={name === 'Email' ? 'mailto:' + value : value} target={name === 'Email' ? '_self' : '_blank'} rel='noreferrer'>{name} ↗</a>
        ))}
        {!entries.length && <p className='muted'>Contact links have not been configured yet.</p>}
      </div>
    </main>
  );
}
