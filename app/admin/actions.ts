'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PH = /[{][{]input_encoded[}][}]|[{][{]input_raw[}][}]|[{][{]input[}][}]|[{][}]/g;

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
}
function back(kind: 'error' | 'message', text: string): never {
  redirect('/admin/tools?' + kind + '=' + encodeURIComponent(text));
}
function refresh(slug?: string) {
  revalidatePath('/admin/tools');
  revalidatePath('/admin');
  revalidatePath('/tools');
  revalidatePath('/');
  if (slug) revalidatePath('/tools/' + slug);
}

type Fields = {
  tool: { name: string; description: string; category: string; credit_cost: number; enabled: boolean };
  api: { url: string; method: 'GET' | 'POST'; param_name: string; headers_json: string; body_template: string; content_type: string };
};

function readFields(form: FormData): Fields | { error: string } {
  const name = String(form.get('name') || '').trim().slice(0, 80);
  const description = String(form.get('description') || '').trim().slice(0, 240);
  const category = String(form.get('category') || '').trim().slice(0, 40) || 'General';
  const credit_cost = Number(form.get('credit_cost'));
  const enabled = form.get('enabled') === 'on';
  const url = String(form.get('api_url') || '').trim();
  const method = String(form.get('method') || 'GET').toUpperCase() === 'POST' ? 'POST' : 'GET';
  const param_name = String(form.get('param_name') || 'query').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60) || 'query';
  const headers_json = String(form.get('headers_json') || '{}').trim() || '{}';
  const body_template = String(form.get('body_template') || '').slice(0, 12000);
  const content_type = String(form.get('content_type') || 'application/json').trim().slice(0, 100) || 'application/json';
  if (name.length < 2) return { error: 'Tool name must be at least 2 characters.' };
  if (!Number.isInteger(credit_cost) || credit_cost < 0 || credit_cost > 1000) return { error: 'Credit cost must be a whole number between 0 and 1000.' };
  if (!url || url.length > 2000) return { error: 'Enter the API URL.' };
  let parsed: URL;
  try { parsed = new URL(url.replace(PH, 'demo')); } catch { return { error: 'Enter a valid API URL. Use {} where the user input should go.' }; }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return { error: 'API URL must use HTTP or HTTPS without embedded credentials.' };
  try {
    const h = JSON.parse(headers_json);
    if (!h || Array.isArray(h) || typeof h !== 'object' || Object.values(h).some((v) => typeof v !== 'string')) throw new Error('x');
  } catch { return { error: 'Headers must be a JSON object with string values.' }; }
  return { tool: { name, description, category, credit_cost, enabled }, api: { url, method, param_name, headers_json, body_template, content_type } };
}

export async function adjustCredits(form: FormData) {
  const { supabase } = await requireAdmin();
  const userId = String(form.get('user_id') || '');
  const amount = Number(form.get('amount'));
  const reason = String(form.get('reason') || 'Admin adjustment').trim().slice(0, 160);
  if (!userId || !Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 10000) throw new Error('Invalid adjustment');
  const { error } = await supabase.rpc('admin_adjust_credits', { p_user_id: userId, p_amount: amount, p_reason: reason || 'Admin adjustment' });
  if (error) throw new Error(error.message);
  revalidatePath('/admin'); revalidatePath('/admin/users'); revalidatePath('/credits');
}

export async function setUserRole(form: FormData) {
  const { supabase } = await requireAdmin();
  const userId = String(form.get('user_id') || '');
  const role = String(form.get('role') || '');
  if (!userId || !['user', 'admin'].includes(role)) throw new Error('Invalid user role');
  const { error } = await supabase.rpc('admin_set_user_role', { p_user_id: userId, p_role: role });
  if (error) throw new Error(error.message);
  revalidatePath('/admin'); revalidatePath('/admin/users');
}

export async function createTool(form: FormData) {
  const { supabase } = await requireAdmin();
  const r = readFields(form);
  if ('error' in r) back('error', r.error);
  const slug = slugify(r.tool.name);
  if (!slug || !SLUG_RE.test(slug)) back('error', 'Use letters or numbers in the tool name.');
  const { error } = await supabase.from('tools').insert({ slug, ...r.tool });
  if (error) back('error', error.code === '23505' ? 'A tool with this name already exists.' : error.message);
  const { error: apiError } = await supabase.from('tool_apis').insert({ slug, ...r.api });
  if (apiError) { await supabase.from('tools').delete().eq('slug', slug); back('error', apiError.message); }
  refresh(slug);
  back('message', 'Tool “' + r.tool.name + '” added. It is now live for users.');
}

export async function updateTool(form: FormData) {
  const { supabase } = await requireAdmin();
  const slug = String(form.get('slug') || '');
  if (!SLUG_RE.test(slug)) back('error', 'Invalid tool.');
  const r = readFields(form);
  if ('error' in r) back('error', r.error);
  const { error } = await supabase.from('tools').update(r.tool).eq('slug', slug);
  if (error) back('error', error.message);
  const { error: apiError } = await supabase.from('tool_apis').upsert({ slug, ...r.api, updated_at: new Date().toISOString() });
  if (apiError) back('error', apiError.message);
  refresh(slug);
  back('message', 'Changes saved for “' + r.tool.name + '”.');
}

export async function toggleTool(form: FormData) {
  const { supabase } = await requireAdmin();
  const slug = String(form.get('slug') || '');
  if (!SLUG_RE.test(slug)) back('error', 'Invalid tool.');
  const enabled = form.get('enabled') === '1';
  const { error } = await supabase.from('tools').update({ enabled }).eq('slug', slug);
  if (error) back('error', error.message);
  refresh(slug);
  back('message', enabled ? 'Tool is now visible to users.' : 'Tool is now hidden from users.');
}

export async function deleteTool(form: FormData) {
  const { supabase } = await requireAdmin();
  const slug = String(form.get('slug') || '');
  if (!SLUG_RE.test(slug)) back('error', 'Invalid tool.');
  const { error } = await supabase.from('tools').delete().eq('slug', slug);
  if (error) back('error', error.message);
  refresh(slug);
  back('message', 'Tool deleted. Its API settings were removed too.');
}
