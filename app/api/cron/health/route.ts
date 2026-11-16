import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== 'Bearer ' + secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let db: ReturnType<typeof createAdminClient>;
  try { db = createAdminClient(); } catch { return NextResponse.json({ error: 'Service role key is not configured' }, { status: 503 }); }
  const started = Date.now();
  const { error } = await db.from('tools').select('slug', { count: 'exact', head: true });
  const latency = Date.now() - started;
  const status = error ? 'offline' : latency > 1500 ? 'degraded' : 'online';
  await db.from('health_checks').insert({ service: 'Supabase database', status, latency_ms: latency, details: error ? error.message.slice(0, 200) : 'Query OK' });
  await db.from('health_checks').delete().lt('checked_at', new Date(Date.now() - 30 * 86400000).toISOString());
  return NextResponse.json({ ok: !error, status, latency_ms: latency });
}
