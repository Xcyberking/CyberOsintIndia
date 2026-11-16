import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import ConfirmButton from '@/components/ConfirmButton';
import { createTool, updateTool, deleteTool, toggleTool } from '../actions';

function Fields({ t, api }: { t?: any; api?: any }) {
  return (
    <div className='form-grid'>
      <label>Tool name<input name='name' required minLength={2} maxLength={80} defaultValue={t?.name || ''} placeholder='Example: Number info' /></label>
      <label>Category<input name='category' maxLength={40} defaultValue={t?.category || 'General'} /></label>
      <label className='full'>Description<textarea name='description' rows={2} maxLength={240} defaultValue={t?.description || ''} placeholder='Short text shown on the tool card' /></label>
      <label className='full'>API URL<input name='api_url' required maxLength={2000} defaultValue={api?.url || ''} placeholder='https://your-api.example.com/lookup?q={}' /><span className='hint'>Put <code>{'{}'}</code> where the user input should go. If you leave it out, input is sent as a query parameter.</span></label>
      <label>Credit cost<input name='credit_cost' type='number' min={0} max={1000} required defaultValue={t?.credit_cost ?? 1} /></label>
      <label>Method<select name='method' defaultValue={api?.method || 'GET'}><option value='GET'>GET</option><option value='POST'>POST</option></select></label>
      <label className='check full'><input type='checkbox' name='enabled' defaultChecked={t ? t.enabled : true} /> Live and visible to users</label>
      <details className='advanced full'>
        <summary>Advanced API options</summary>
        <div className='form-grid'>
          <label>Query parameter name<input name='param_name' maxLength={60} defaultValue={api?.param_name || 'query'} /></label>
          <label>Content type (POST)<input name='content_type' maxLength={100} defaultValue={api?.content_type || 'application/json'} /></label>
          <label className='full'>Headers (JSON)<textarea name='headers_json' rows={3} defaultValue={api?.headers_json || '{}'} placeholder='{"Authorization":"Bearer {{env:MY_API_KEY}}"}' /><span className='hint'>Keep secrets in Vercel env vars and reference them as <code>{'{{env:NAME}}'}</code>.</span></label>
          <label className='full'>POST body template<textarea name='body_template' rows={3} defaultValue={api?.body_template || ''} placeholder='{"query":"{{input}}"}' /></label>
        </div>
      </details>
    </div>
  );
}

export default async function AdminTools({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const q = await searchParams;
  const { supabase } = await requireAdmin();
  const [{ data: tools }, { data: apis }] = await Promise.all([
    supabase.from('tools').select('slug,name,description,category,credit_cost,enabled').order('created_at', { ascending: false }),
    supabase.from('tool_apis').select('slug,url,method,param_name,headers_json,body_template,content_type'),
  ]);
  const apiMap = new Map((apis || []).map((a: any) => [a.slug, a]));
  return (
    <main className='panel-page'>
      <Link href='/admin'>← Overview</Link>
      <span className='eyebrow'>Tool manager</span>
      <h1>Tools</h1>
      <p>Only the tools listed here are shown to users. Add, edit, hide or delete them anytime.</p>
      {q.error && <div className='error'>{q.error}</div>}
      {q.message && <div className='success'>{q.message}</div>}

      <h2>Add a new tool</h2>
      <form action={createTool} className='panel-card'>
        <Fields />
        <div className='form-actions'><button className='primary' type='submit'>Add tool</button></div>
      </form>

      <h2>Your tools ({tools?.length ?? 0})</h2>
      <div className='admin-tool-list'>
        {tools?.map((t: any) => {
          const api: any = apiMap.get(t.slug);
          return (
            <article className='admin-tool-card' key={t.slug}>
              <div className='tool-card-head'>
                <div className='info'><b>{t.name}</b><small>/{t.slug} · {t.category} · {t.credit_cost} credit{t.credit_cost === 1 ? '' : 's'}</small></div>
                <span className={'badge ' + (t.enabled ? 'on' : 'off')}>{t.enabled ? 'Live' : 'Hidden'}</span>
                {!api && <span className='badge warn'>No API</span>}
                <div className='tool-card-actions'>
                  <form action={toggleTool}><input type='hidden' name='slug' value={t.slug} /><input type='hidden' name='enabled' value={t.enabled ? '0' : '1'} /><button className='ghost' type='submit'>{t.enabled ? 'Hide' : 'Show'}</button></form>
                  <form action={deleteTool}><input type='hidden' name='slug' value={t.slug} /><ConfirmButton className='danger' message={'Delete “' + t.name + '” permanently? Its API settings are removed too.'}>Delete</ConfirmButton></form>
                </div>
              </div>
              <details>
                <summary>Edit tool and API</summary>
                <form action={updateTool} className='tool-edit-form'>
                  <input type='hidden' name='slug' value={t.slug} />
                  <Fields t={t} api={api} />
                  <div className='form-actions'><button className='primary' type='submit'>Save changes</button></div>
                </form>
              </details>
            </article>
          );
        })}
        {!tools?.length && <p className='empty'>No tools yet. Add your first tool above.</p>}
      </div>
    </main>
  );
}
