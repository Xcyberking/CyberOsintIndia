import Link from 'next/link';
import AuthActions from '@/components/AuthActions';
import { createPublicClient } from '@/lib/supabase/public';
import { Shield, Search, ArrowUpRight, LockKeyhole, Zap, Activity, Github, Wrench, ShieldCheck, Check } from 'lucide-react';

export const revalidate = 60;

type ToolRow = { slug: string; name: string; description: string; category: string; credit_cost: number };

async function loadTools(): Promise<ToolRow[]> {
  try {
    const db = createPublicClient();
    const { data } = await db.from('tools').select('slug,name,description,category,credit_cost').eq('enabled', true).order('created_at', { ascending: false }).limit(8);
    return (data as ToolRow[]) || [];
  } catch {
    return [];
  }
}

export default async function Home() {
  const tools = await loadTools();
  return (
    <main>
      <section className='hero' id='home'>
        <div className='copy'>
          <span className='eyebrow'><LockKeyhole size={13} /> Ethical research platform</span>
          <h1>Explore. Investigate.<br /><em>Discover.</em></h1>
          <p>Professional open-source intelligence tools for public-information research and authorized security work, in one clean workspace.</p>
          <div className='buttons'>
            <Link href='/tools' className='primary big'><Search size={18} /> Explore tools <ArrowUpRight size={18} /></Link>
            <AuthActions cta />
          </div>
          <div className='trust'>
            <span><Shield /> Privacy-conscious</span>
            <span><Zap /> Fast workflows</span>
            <span><Activity /> Clear results</span>
          </div>
        </div>
        <div className='visual'>
          <div className='console'>
            <div className='console-bar'><span /><span /><span /></div>
            <div className='console-input'><Search size={16} /> Enter a value to look up…</div>
            <div className='console-line w90' /><div className='console-line w70' /><div className='console-line w50' />
            <small><i className='dot' /> Secure workspace ready</small>
          </div>
        </div>
      </section>

      <section className='section' id='tools'>
        <div className='heading'>
          <div><span className='eyebrow'>Research workspace</span><h2>Available <em>tools</em></h2><p>Every tool is added and managed by the admin team.</p></div>
          <Link href='/tools'>View all tools <ArrowUpRight size={14} /></Link>
        </div>
        {tools.length ? (
          <div className='grid'>
            {tools.map((t) => (
              <Link href={'/tools/' + t.slug} className='card' key={t.slug}>
                <span className='icon'><Wrench size={20} /></span>
                <span><b>{t.name}</b><small>{t.description || t.category}</small><span className='meta'>{t.credit_cost} credit{t.credit_cost === 1 ? '' : 's'}</span></span>
              </Link>
            ))}
          </div>
        ) : (
          <p className='empty'>No tools have been published yet. Check back soon.</p>
        )}
      </section>

      <section className='section about' id='about'>
        <div className='shield'><Shield /><Check /></div>
        <div>
          <span className='eyebrow'>Responsible use</span>
          <h2>Built for <em>ethical</em> research</h2>
          <p>CyberX OSINT is intended for lawful investigation of public information, education and authorized security testing.</p>
          <ul><li>Use only publicly available information</li><li>Respect privacy and local laws</li><li>Never target people without authorization</li></ul>
        </div>
      </section>

      <section className='cta'>
        <div><span className='eyebrow'>Get started</span><h2>Start your <em>research</em> today</h2></div>
        <AuthActions cta />
      </section>

      <footer>
        <div className='brand'><span className='logo'><ShieldCheck size={19} /></span><span>CyberX <i>OSINT</i></span></div>
        <p>Open-source intelligence tools for public-information research and authorized security work.</p>
        <div className='footer-links'><Link href='/tools'>Tools</Link><Link href='/announcements'>Updates</Link><Link href='/contact'>Contact</Link></div>
        <div className='social'><a href='https://github.com/Xcyberking/CyberOsintIndia' target='_blank' rel='noreferrer' aria-label='GitHub'><Github size={18} /></a></div>
        <small>© {new Date().getFullYear()} CyberX OSINT. All rights reserved.</small>
      </footer>
    </main>
  );
}
