import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const maxDuration = 30;

const inputSchema = z.object({
  tool: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60),
  input: z.string().trim().min(1).max(12000),
});
// Placeholders: {} and {{input}} (URL-encoded), {{input_encoded}}, {{input_raw}}. Character classes avoid regex escapes.
const PH = /[{][{]input_encoded[}][}]|[{][{]input_raw[}][}]|[{][{]input[}][}]|[{][}]/g;
const BODY_PH = /[{][{]input_encoded[}][}]|[{][{]input_raw[}][}]|[{][{]input[}][}]/g;
const ENV_PH = /[{][{]env:([A-Z0-9_]+)[}][}]/g;
const BLOCKED_ENV = /^(SUPABASE_SERVICE_ROLE_KEY|CRON_SECRET)$/;

function normalizeBody(value: any, depth = 0): any {
  if (depth > 6) return '...';
  if (Array.isArray(value)) return value.slice(0, 100).map((v) => normalizeBody(v, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 200).map(([k, v]) => [k, normalizeBody(v, depth + 1)]));
  if (typeof value === 'string') return value.slice(0, 5000);
  return value;
}

function isPrivateHost(h: string) {
  const host = h.toLowerCase();
  return host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host === '0.0.0.0' || host === '::1' || host === '[::1]'
    || /^127[.]/.test(host) || /^10[.]/.test(host) || /^192[.]168[.]/.test(host) || /^169[.]254[.]/.test(host) || /^172[.](1[6-9]|2[0-9]|3[01])[.]/.test(host);
}

async function runCustomApi(cfg: any, input: string) {
  const template = String(cfg.url || '');
  let expected: string;
  try { expected = new URL(template.replace(PH, 'demo')).origin; } catch { throw new Error('The configured API URL is invalid.'); }
  const hasPlaceholder = template.search(PH) >= 0;
  let url = template.replace(PH, (m) => (m === '{{input_raw}}' ? input : encodeURIComponent(input)));
  if (!hasPlaceholder) {
    const param = String(cfg.param_name || 'query').replace(/[^a-zA-Z0-9_-]/g, '') || 'query';
    const p = new URL(url);
    p.searchParams.set(param, input);
    url = p.toString();
  }
  const target = new URL(url);
  if (!['https:', 'http:'].includes(target.protocol) || target.username || target.password) throw new Error('API URL must be a valid HTTP or HTTPS endpoint.');
  if (target.origin !== expected) throw new Error('API host mismatch.');
  if (isPrivateHost(target.hostname)) throw new Error('Private or local API hosts are not allowed.');

  const headers: Record<string, string> = { Accept: 'application/json, text/plain, application/xml, text/xml, */*' };
  try {
    const custom = JSON.parse(cfg.headers_json || '{}');
    if (!custom || Array.isArray(custom) || typeof custom !== 'object') throw new Error('x');
    for (const [k, v] of Object.entries(custom)) {
      if (!/^[a-zA-Z0-9-]{1,60}$/.test(k) || typeof v !== 'string' || v.length > 1000) throw new Error('x');
      headers[k] = v.replace(ENV_PH, (_m, n: string) => (BLOCKED_ENV.test(n) ? '' : process.env[n] || ''));
    }
  } catch {
    throw new Error('API headers must be a valid JSON object with string values.');
  }

  const method = cfg.method === 'POST' ? 'POST' : 'GET';
  const init: RequestInit = { method, headers, signal: AbortSignal.timeout(15000), cache: 'no-store', redirect: 'error' };
  if (method === 'POST') {
    const ct = String(cfg.content_type || 'application/json');
    const json = /json/i.test(ct);
    headers['Content-Type'] = ct;
    init.body = String(cfg.body_template || '{"query":"{{input}}"}').replace(BODY_PH, (m) => (m === '{{input_encoded}}' ? encodeURIComponent(input) : m === '{{input_raw}}' ? input : json ? JSON.stringify(input).slice(1, -1) : input));
  }

  const res = await fetch(target, init);
  const text = await res.text();
  if (!res.ok) throw new Error('The tool API returned an error (HTTP ' + res.status + ').');
  if (text.length > 1000000) throw new Error('The tool API response is too large.');
  try { return normalizeBody(JSON.parse(text)); } catch { return { result: text.slice(0, 20000) }; }
}

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid value to search.' }, { status: 400 });
  const { tool, input } = parsed.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please log in to run this tool.' }, { status: 401 });

  let admin: ReturnType<typeof createAdminClient>;
  try { admin = createAdminClient(); } catch { return NextResponse.json({ error: 'Server is not fully configured yet. Please try again later.' }, { status: 503 }); }

  // Private API config is only readable with the service role, never by browsers.
  const [toolRes, apiRes] = await Promise.all([
    supabase.from('tools').select('slug').eq('slug', tool).eq('enabled', true).maybeSingle(),
    admin.from('tool_apis').select('url,method,param_name,headers_json,body_template,content_type').eq('slug', tool).maybeSingle(),
  ]);
  if (!toolRes.data || !apiRes.data) return NextResponse.json({ error: 'This tool is not available right now.' }, { status: 404 });

  // Charge first (atomic, blocks parallel free runs), refund if the API fails.
  const { data: billing, error: billError } = await supabase.rpc('consume_tool_credit', { p_tool_slug: tool });
  if (billError) {
    const m = billError.message || 'Could not charge credits.';
    return NextResponse.json({ error: m }, { status: /insufficient/i.test(m) ? 402 : 400 });
  }
  const charged = Number(billing?.charged ?? 0);
  const summary = input.slice(0, 120);

  try {
    const data = await runCustomApi(apiRes.data, input);
    await supabase.from('search_history').insert({ user_id: user.id, tool_slug: tool, input_summary: summary, status: 'success' });
    return NextResponse.json({ success: true, data, charged });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'The tool API request failed.';
    await Promise.allSettled([
      charged > 0 ? admin.rpc('refund_credit', { p_user_id: user.id, p_amount: charged, p_reason: 'Refund: ' + tool + ' failed' }) : Promise.resolve(),
      supabase.from('search_history').insert({ user_id: user.id, tool_slug: tool, input_summary: summary, status: 'error' }),
    ]);
    return NextResponse.json({ error: message + (charged > 0 ? ' Your credits were refunded.' : '') }, { status: 502 });
  }
}
