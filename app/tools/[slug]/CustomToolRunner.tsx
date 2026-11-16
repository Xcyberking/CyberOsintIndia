'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { ReactNode } from 'react';

function Value({ value }: { value: any }): ReactNode {
  if (value === null || value === undefined || value === '') return <span className='api-null'>Not available</span>;
  if (typeof value === 'boolean') return <span className={value ? 'api-true' : 'api-false'}>{value ? 'Yes' : 'No'}</span>;
  if (typeof value === 'string' || typeof value === 'number') return <span className='api-value'>{String(value)}</span>;
  if (Array.isArray(value)) return <div className='api-array'>{value.map((v, i) => <div className='api-array-item' key={i}><Value value={v} /></div>)}</div>;
  return <div className='api-object'>{Object.entries(value).map(([k, v]) => <div className='api-field' key={k}><b>{k.replace(/[_-]/g, ' ')}</b><Value value={v} /></div>)}</div>;
}

export default function CustomToolRunner({ slug, title, description, creditCost }: { slug: string; title: string; description: string | null; creditCost: number }) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (busy || !input.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch('/api/tools', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tool: slug, input }) });
      const payload = await r.json().catch(() => ({ error: 'Unexpected server response' }));
      if (r.status === 401) { setResult({ error: 'Please log in to run this tool.', login: true }); return; }
      if (!r.ok) throw new Error(payload.error || 'API request failed');
      setResult(payload);
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : 'Request failed' });
    } finally {
      setBusy(false);
    }
  }

  async function exportPdf() {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    const text = JSON.stringify(result?.data ?? result, null, 2);
    const lines = doc.splitTextToSize(text, 180) as string[];
    doc.setFontSize(14);
    doc.text(title, 14, 14);
    doc.setFontSize(9);
    let y = 24;
    for (const line of lines) {
      if (y > 285) { doc.addPage(); y = 20; }
      doc.text(line, 14, y);
      y += 5;
    }
    doc.save(slug + '-result.pdf');
  }

  return (
    <main className='panel-page'>
      <Link href='/tools'>← All tools</Link>
      <span className='eyebrow'>{creditCost} credit{creditCost === 1 ? '' : 's'} per search</span>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
      <form className='tool-form' onSubmit={(e) => { e.preventDefault(); run(); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder='Enter a value to search' maxLength={12000} required />
        <button className='primary' type='submit' disabled={busy || !input.trim()}>{busy ? 'Searching…' : 'Search'}</button>
      </form>
      {result?.error && <div className='error'>{result.error}{result.login && <> <Link href='/login'><b>Log in</b></Link></>}</div>}
      {result?.success && (
        <section className='api-result-card'>
          <div className='api-result-head'>
            <div><span className='eyebrow'>Result</span><h2>{title}</h2><small>Credits used: {result.charged ?? 0}</small></div>
            <button className='ghost' type='button' onClick={exportPdf}>Export PDF</button>
          </div>
          <Value value={result.data} />
          <div className='api-result-foot'>Use results lawfully and respect the privacy of others.</div>
        </section>
      )}
    </main>
  );
}
