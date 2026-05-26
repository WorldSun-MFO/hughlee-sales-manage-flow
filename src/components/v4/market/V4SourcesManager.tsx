'use client';

// V4 來源管理 — 同 SourcesManager API,v4 視覺
import { useState } from 'react';
import { Loader2, Plus, Power, Trash2, Database, Globe } from 'lucide-react';
import type { IngestSource, IntelRegion } from '@/lib/types';
import { REGIONS } from '@/lib/market/constants';
import { cn } from '@/lib/v4/utils';

const REGION_BADGE: Record<string, string> = {
  TW: '🇹🇼 TW', US: '🇺🇸 US', JP: '🇯🇵 JP', CN: '🇨🇳 CN', GLOBAL: '🌐 GLOBAL',
};

export function V4SourcesManager({
  initialSources,
  canManage,
}: {
  initialSources: IngestSource[];
  canManage: boolean;
}) {
  const [sources, setSources] = useState<IngestSource[]>(initialSources);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [region, setRegion] = useState<IntelRegion | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toggleBusyId, setToggleBusyId] = useState<string | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);

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
      setSources((s) => [...s, json.data as IngestSource]);
      setName(''); setUrl(''); setRegion('');
    } catch { setError('網路錯誤,請再試一次'); }
    finally { setBusy(false); }
  }

  async function toggle(src: IngestSource) {
    setToggleBusyId(src.id);
    setSources((s) => s.map((x) => x.id === src.id ? { ...x, active: !x.active } : x));
    const res = await fetch(`/api/market/sources/${src.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !src.active }),
    });
    setToggleBusyId(null);
    if (!res.ok) {
      setSources((s) => s.map((x) => x.id === src.id ? { ...x, active: src.active } : x));
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? '更新失敗');
    }
  }

  async function remove(src: IngestSource) {
    if (!confirm(`刪除來源「${src.name}」?(已抓進來的情報不會被刪)`)) return;
    setDeleteBusyId(src.id);
    const res = await fetch(`/api/market/sources/${src.id}`, { method: 'DELETE' });
    setDeleteBusyId(null);
    if (res.ok) {
      setSources((s) => s.filter((x) => x.id !== src.id));
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? '刪除失敗');
    }
  }

  return (
    <div className="grid gap-4">
      {error && (
        <div className="rounded-md border border-claret/30 bg-claret/5 px-3 py-2 text-sm text-claret">{error}</div>
      )}

      {canManage ? (
        <section className="grid gap-3 rounded-md border border-ink/10 bg-paper p-5">
          <div className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4 text-ink" strokeWidth={2} />
            <span className="font-v4-serif text-base font-semibold text-ink">新增 RSS / API 來源</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_2fr_160px_auto]">
            <input
              className="h-9 rounded-md border border-ink/15 bg-cream/40 px-3 text-sm text-ink focus:border-ink/40 focus:outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="名稱(例:經濟日報 即時)"
            />
            <input
              className="h-9 rounded-md border border-ink/15 bg-cream/40 px-3 font-v4-mono text-xs text-ink focus:border-ink/40 focus:outline-none"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="RSS 網址 https://…"
            />
            <select
              className="h-9 rounded-md border border-ink/15 bg-cream/40 px-3 text-sm text-ink focus:border-ink/40 focus:outline-none"
              value={region}
              onChange={(e) => setRegion(e.target.value as IntelRegion | '')}
            >
              <option value="">地區(可空)</option>
              {REGIONS.map((r) => <option key={r.key} value={r.key}>{r.flag} {r.label}</option>)}
            </select>
            <button
              onClick={add}
              disabled={busy}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-paper transition',
                busy ? 'bg-ink/30 cursor-not-allowed' : 'bg-ink hover:bg-graphite',
              )}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : <Plus className="h-4 w-4" strokeWidth={2} />}
              {busy ? '新增中…' : '新增'}
            </button>
          </div>
          <p className="font-v4-mono text-[10.5px] text-ink/55 leading-5">
            支援標準 RSS / Atom。Google News 查詢格式:
            <code className="ml-1 rounded-sm bg-cream/80 px-1.5 py-0.5 text-[10px]">
              https://news.google.com/rss/search?q=關鍵字&hl=zh-TW&gl=TW&ceid=TW:zh-Hant
            </code>
          </p>
        </section>
      ) : (
        <p className="font-v4-mono text-[11px] text-ink/45">
          只有管理員 / 團隊主管可以新增或修改來源。以下為目前清單。
        </p>
      )}

      <section className="grid gap-2">
        <div className="flex items-baseline justify-between">
          <div className="inline-flex items-center gap-2">
            <Database className="h-3 w-3 text-ink/55" strokeWidth={2} />
            <span className="label-caps text-ink/55">來源清單 · {sources.length}</span>
          </div>
          <span className="font-v4-mono text-[10.5px] text-ink/45">每 3 小時跑一次 · 公平輪替排序</span>
        </div>

        <div className="grid gap-2">
          {sources.length === 0 ? (
            <div className="grid place-items-center gap-2 rounded-md border border-dashed border-ink/15 bg-paper/60 px-6 py-12 text-center">
              <Database className="h-5 w-5 text-ink/30" strokeWidth={1.5} />
              <div className="text-sm text-ink/55">還沒有任何來源。</div>
            </div>
          ) : sources.map((src) => (
            <div key={src.id} className={cn('grid grid-cols-[1fr_auto] items-start gap-3 rounded-md border p-4 transition',
              src.active ? 'border-ink/10 bg-paper' : 'border-ink/8 bg-cream/40')}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-v4-serif text-base font-semibold text-ink truncate">{src.name}</span>
                  {src.region && (
                    <span className="rounded-sm bg-ink/8 px-1.5 py-0.5 font-v4-mono text-[10px] text-ink/65">
                      {REGION_BADGE[src.region] ?? src.region}
                    </span>
                  )}
                  <span className={cn(
                    'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-v4-mono text-[10px] font-bold',
                    src.active ? 'bg-forest/15 text-forest' : 'bg-ink/8 text-ink/45',
                  )}>
                    <span className={cn('grid h-1.5 w-1.5 rounded-full', src.active ? 'bg-forest animate-pulse' : 'bg-ink/30')} />
                    {src.active ? '啟用中' : '已停用'}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <Globe className="h-3 w-3 text-ink/40 shrink-0" strokeWidth={2} />
                  <span className="font-v4-mono text-[11px] text-ink/55 truncate">{src.url}</span>
                </div>
                <div className="mt-1 font-v4-mono text-[10.5px] text-ink/45 numeric">
                  {src.last_run_at
                    ? `上次跑: ${src.last_run_at.slice(0, 16).replace('T', ' ')}`
                    : '尚未跑過(下次 cron 會優先排到這個)'}
                  {src.last_status ? `  ·  ${src.last_status}` : ''}
                </div>
              </div>
              {canManage && (
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    onClick={() => toggle(src)}
                    disabled={toggleBusyId === src.id}
                    className={cn(
                      'inline-flex items-center justify-center gap-1 rounded-md border px-2.5 py-1 font-v4-mono text-xs font-semibold transition w-20',
                      src.active
                        ? 'border-ink/15 text-ink/65 hover:border-ink/30 hover:text-ink'
                        : 'border-forest/30 text-forest hover:bg-forest/8',
                    )}
                  >
                    {toggleBusyId === src.id ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} /> : <Power className="h-3 w-3" strokeWidth={2} />}
                    {src.active ? '停用' : '啟用'}
                  </button>
                  <button
                    onClick={() => remove(src)}
                    disabled={deleteBusyId === src.id}
                    className="inline-flex items-center justify-center gap-1 rounded-md border border-claret/30 px-2.5 py-1 font-v4-mono text-xs font-semibold text-claret transition hover:bg-claret/8 w-20"
                  >
                    {deleteBusyId === src.id ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} /> : <Trash2 className="h-3 w-3" strokeWidth={2} />}
                    刪除
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
