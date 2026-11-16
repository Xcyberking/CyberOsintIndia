import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { supabase } = await requireAdmin();
  const checks: { name: string; status: string; provider: string }[] = [];
  checks.push({ name: 'Supabase configuration', status: process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'configured' : 'missing', provider: 'Public URL and anon key' });
  checks.push({ name: 'Server service key', status: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'configured' : 'missing', provider: 'Needed by the tool API proxy' });
  checks.push({ name: 'Cron secret', status: process.env.CRON_SECRET ? 'configured' : 'missing', provider: 'Needed by the daily health check' });
  const started = Date.now();
  const { error } = await supabase.from('tools').select('slug', { count: 'exact', head: true });
  checks.push({ name: 'Database', status: error ? 'unavailable' : 'online', provider: 'Supabase Postgres, ' + (Date.now() - started) + ' ms' });
  const [live, apis] = await Promise.all([
    supabase.from('tools').select('slug', { count: 'exact', head: true }).eq('enabled', true),
    supabase.from('tool_apis').select('slug', { count: 'exact', head: true }),
  ]);
  checks.push({ name: 'Live tools', status: (live.count ?? 0) > 0 ? 'online' : 'none', provider: (live.count ?? 0) + ' live, ' + (apis.count ?? 0) + ' with API' });
  return NextResponse.json({ checkedAt: new Date().toISOString(), checks });
}
