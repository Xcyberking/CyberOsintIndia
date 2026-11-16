'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AuthActions({ cta = false }: { cta?: boolean }) {
  const [status, setStatus] = useState<'loading' | 'signed-in' | 'signed-out'>('loading');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    // getSession reads local storage/cookies: no network round trip.
    supabase.auth.getSession().then(({ data }) => { if (alive) setStatus(data.session ? 'signed-in' : 'signed-out'); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { if (alive) setStatus(session ? 'signed-in' : 'signed-out'); });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);
  async function logout() {
    setBusy(true);
    const { error } = await createClient().auth.signOut();
    setBusy(false);
    if (!error) { setStatus('signed-out'); router.push('/'); router.refresh(); }
  }
  if (status === 'loading') return <div aria-hidden='true' style={{ minWidth: cta ? 190 : 120, minHeight: 42 }} />;
  if (status === 'signed-in') return cta
    ? <Link href='/dashboard' className='primary big'>Open dashboard <span aria-hidden>↗</span></Link>
    : <div className='actions'><Link href='/dashboard' className='ghost'>Dashboard</Link><button type='button' className='ghost' disabled={busy} onClick={logout}>{busy ? 'Logging out…' : 'Logout'}</button></div>;
  return cta
    ? <Link href='/register' className='primary big'>Create free account <span aria-hidden>↗</span></Link>
    : <div className='actions'><Link href='/login' className='ghost'>Login</Link><Link href='/register' className='primary'>Register</Link></div>;
}
