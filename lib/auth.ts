import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// One auth + role lookup per request, shared by layouts and pages.
const getCtx = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, role: 'user' };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  return { supabase, user, role: String(profile?.role || 'user') };
});

export async function requireUser() {
  const c = await getCtx();
  if (!c.user) redirect('/login');
  return { supabase: c.supabase, user: c.user, role: c.role };
}

export async function requireAdmin() {
  const c = await requireUser();
  if (c.role !== 'admin') redirect('/dashboard');
  return c;
}
