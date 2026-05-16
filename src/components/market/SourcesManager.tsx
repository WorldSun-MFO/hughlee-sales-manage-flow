'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { IngestSource, IntelRegion } from '@/lib/types';
import { REGIONS } from '@/lib/market/constants';

export function SourcesManager({
  initialSources,
  canManage,
}: {
  initialSources: IngestSource[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [sources, setSources] = useState<IngestSource[]>(initialSources);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [region, setRegion] = useState<IntelRegion | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function add() {
    if (!name.trim() || !url.trim()) { setError('名稱和網址都要填'); return; }
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/market/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url, region: region || null }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? '新增失敗'); setBusy(false); return; }
      setSources(s => [...s, json.data as IngestSource]);
      setName(''); setUrl(''); setRegion('');
    } catch { setError('網路錯誤,請再試一次'); }
    finally { setBusy(false); }
  }

  async function toggle(src: IngestSource) {
    setSources(s => s.map(x => x.id === src.id ? { ...x, active: !x.active } : x));
    const res = await fetch(`/api/market/sources/${src.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !src.active }),
    });
    if (!res.ok) {
      setSources(s => s.map(x => x.id === src.id ? { ...x, active: src.active } : x)); // 還原
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? '更新失敗');
    }
  }

  async function remove(src: IngestSource) {
    if (!confirm(`刪除來源「${src.name}」?(已抓進來的情報不會被刪)`)) return;
    const res = await fetch(`/api/market/sources/${src.id}`, { method: 'DELETE' });
    if (res.ok) {
      setSources(s => s.filter(x => x.id !== src.id));
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? '刪除失敗');
    }
  }

  const inputCls = 'h-9 rounded-lg border border-slate-200 px-3 text-sm focus:border-indigo-400 focus:outline-none';

  return (
    <div className="max-w-3xl space-y-4">
      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">{error}</div>
      )}

      {canManage ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="text-sm font-semibold text-slate-700">➕ 新增 RSS 來源</div>
          <div className="flex flex-wrap gap-2">
            <input className={`${inputCls} flex-1 min-w-[140px]`} value={name} onChange={e => setName(e.target.value)}
              placeholder="名稱(例:經濟日報 即時)" />
            <input className={`${inputCls} flex-[2] min-w-[220px]`} value={url} onChange={e => setUrl(e.target.value)}
              placeholder="RSS 網址 https://…" />
            <select className={inputCls} value={region} onChange={e => setRegion(e.target.value as IntelRegion | '')}>
              <option value="">地區(可空)</option>
              {REGIONS.map(r => <option key={r.key} value={r.key}>{r.flag} {r.label}</option>)}
            </select>
            <button onClick={add} disabled={busy}
              className="h-9 px-4 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {busy ? '新增中…' : '新增'}
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            支援標準 RSS / Atom。Google News 查詢格式:
            <code className="bg-slate-100 px-1 rounded">https://news.google.com/rss/search?q=關鍵字&hl=zh-TW&gl=TW&ceid=TW:zh-Hant</code>
          </p>
        </div>
      ) : (
        <p className="text-xs text-slate-400">只有管理員 / 團隊主管可以新增或修改來源。以下為目前清單。</p>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {sources.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">還沒有任何來源。</div>
        ) : sources.map(src => (
          <div key={src.id} className="p-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-800">{src.name}</span>
                {src.region && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{src.region}</span>}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${src.active ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                  {src.active ? '啟用中' : '已停用'}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 truncate mt-0.5">{src.url}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {src.last_run_at ? `上次跑:${src.last_run_at.slice(0, 16).replace('T', ' ')}` : '尚未跑過'}
                {src.last_status ? ` · ${src.last_status}` : ''}
              </div>
            </div>
            {canManage && (
              <div className="flex flex-col gap-1 shrink-0">
                <button onClick={() => toggle(src)}
                  className="text-xs px-2 h-7 rounded-md border border-slate-200 hover:bg-slate-50">
                  {src.active ? '停用' : '啟用'}
                </button>
                <button onClick={() => remove(src)}
                  className="text-xs px-2 h-7 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50">
                  刪除
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <button onClick={() => router.push('/market')} className="text-sm text-slate-500 hover:underline">
        ← 回市場大腦
      </button>
    </div>
  );
}
