'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  MarketIntel, MarketTag, DealLite, MarketParseDraft,
  IntelRegion, IntelSourceType, IntelStance, TagCategory,
} from '@/lib/types';
import { REGIONS, SOURCE_TYPES, STANCES, TAG_CATEGORIES } from '@/lib/market/constants';

interface TagRow { category: TagCategory; name: string }
interface LinkRow { deal_id: string; relevance_reason: string }

export function IntelForm({
  mode,
  initial,
  draft,
  existingTags,
  deals = [],
}: {
  mode: 'create' | 'edit';
  initial?: MarketIntel;
  draft?: MarketParseDraft;
  existingTags: MarketTag[];
  deals?: DealLite[];
}) {
  const router = useRouter();

  const [title, setTitle] = useState(initial?.title ?? draft?.title ?? '');
  const [region, setRegion] = useState<IntelRegion>(initial?.region ?? draft?.region ?? 'TW');
  const [sourceType, setSourceType] = useState<IntelSourceType>(initial?.source_type ?? 'broker_research');
  const [sourceName, setSourceName] = useState(initial?.source_name ?? draft?.source_name ?? '');
  const [author, setAuthor] = useState(initial?.author ?? draft?.author ?? '');
  const [sourceUrl, setSourceUrl] = useState(initial?.source_url ?? draft?.source_url ?? '');
  const [publishedAt, setPublishedAt] = useState(initial?.published_at ?? '');
  const [stance, setStance] = useState<IntelStance>(initial?.stance ?? draft?.stance ?? 'na');
  const [summary, setSummary] = useState(initial?.summary ?? draft?.summary ?? '');
  const [keyPointsText, setKeyPointsText] = useState(
    (initial?.key_points ?? draft?.key_points ?? []).join('\n')
  );
  const [tags, setTags] = useState<TagRow[]>(
    (initial?.tags ?? draft?.tags ?? []).map(t => ({ category: t.category, name: t.name }))
  );
  const [links, setLinks] = useState<LinkRow[]>(() => {
    if (initial?.deal_links?.length) {
      return initial.deal_links.map(l => ({ deal_id: l.deal_id, relevance_reason: l.relevance_reason }));
    }
    if (draft?.suggested_deal_links?.length) {
      return draft.suggested_deal_links.map(l => ({ deal_id: l.deal_id, relevance_reason: l.relevance_reason }));
    }
    return [];
  });

  const [dealSearch, setDealSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const dealById = useMemo(() => {
    const m = new Map<string, DealLite>();
    deals.forEach(d => m.set(d.id, d));
    return m;
  }, [deals]);

  const linkedIds = useMemo(() => new Set(links.map(l => l.deal_id)), [links]);

  const searchResults = useMemo(() => {
    const kw = dealSearch.trim().toLowerCase();
    if (!kw) return [];
    return deals
      .filter(d => !linkedIds.has(d.id))
      .filter(d => `${d.name} ${d.product ?? ''}`.toLowerCase().includes(kw))
      .slice(0, 20);
  }, [deals, dealSearch, linkedIds]);

  function addTag() { setTags(t => [...t, { category: 'ticker', name: '' }]); }
  function updateTag(i: number, patch: Partial<TagRow>) {
    setTags(t => t.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function removeTag(i: number) { setTags(t => t.filter((_, idx) => idx !== i)); }

  function addLink(deal_id: string) {
    setLinks(l => (l.some(x => x.deal_id === deal_id) ? l : [...l, { deal_id, relevance_reason: '' }]));
    setDealSearch('');
  }
  function updateLinkReason(deal_id: string, reason: string) {
    setLinks(l => l.map(x => (x.deal_id === deal_id ? { ...x, relevance_reason: reason } : x)));
  }
  function removeLink(deal_id: string) {
    setLinks(l => l.filter(x => x.deal_id !== deal_id));
  }

  async function handleSubmit() {
    if (!title.trim()) { setError('請填標題'); return; }
    setSaving(true);
    setError('');

    const payload = {
      title: title.trim(),
      region,
      source_type: sourceType,
      source_name: sourceName.trim(),
      author: author.trim(),
      source_url: sourceUrl.trim(),
      published_at: publishedAt || null,
      stance,
      summary: summary.trim(),
      key_points: keyPointsText.split('\n').map(s => s.trim()).filter(Boolean),
      tags: tags.map(t => ({ category: t.category, name: t.name.trim() })).filter(t => t.name),
      deal_links: links
        .filter(l => l.deal_id)
        .map(l => ({ deal_id: l.deal_id, relevance_reason: l.relevance_reason.trim() })),
    };

    const url = mode === 'create' ? '/api/market/intel' : `/api/market/intel/${initial!.id}`;
    const method = mode === 'create' ? 'POST' : 'PATCH';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? '儲存失敗');
        setSaving(false);
        return;
      }
      const id = mode === 'create' ? json.data.id : initial!.id;
      router.push(`/market/${id}`);
      router.refresh();
    } catch {
      setError('網路錯誤,請再試一次');
      setSaving(false);
    }
  }

  const labelCls = 'block text-xs font-medium text-slate-500 mb-1';
  const inputCls = 'h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-indigo-400 focus:outline-none';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5 max-w-3xl">
      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">{error}</div>
      )}

      <div>
        <label className={labelCls}>標題 *</label>
        <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)}
          placeholder="例:台積電 2026Q1 法說重點 — 先進製程滿載" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>市場地區</label>
          <select className={inputCls} value={region} onChange={e => setRegion(e.target.value as IntelRegion)}>
            {REGIONS.map(r => <option key={r.key} value={r.key}>{r.flag} {r.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>來源類型</label>
          <select className={inputCls} value={sourceType} onChange={e => setSourceType(e.target.value as IntelSourceType)}>
            {SOURCE_TYPES.map(s => <option key={s.key} value={s.key}>{s.emoji} {s.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>來源名稱(哪一家)</label>
          <input className={inputCls} value={sourceName} onChange={e => setSourceName(e.target.value)}
            placeholder="例:摩根士丹利 / 日經新聞 / TWSE" />
        </div>
        <div>
          <label className={labelCls}>分析師 / 作者</label>
          <input className={inputCls} value={author} onChange={e => setAuthor(e.target.value)} placeholder="可留白" />
        </div>
        <div>
          <label className={labelCls}>原文連結</label>
          <input className={inputCls} value={sourceUrl} onChange={e => setSourceUrl(e.target.value)}
            placeholder="https://… (可留白)" />
        </div>
        <div>
          <label className={labelCls}>原文發布日</label>
          <input type="date" className={inputCls} value={publishedAt ?? ''} onChange={e => setPublishedAt(e.target.value)} />
        </div>
      </div>

      <div>
        <label className={labelCls}>立場</label>
        <div className="flex gap-2">
          {STANCES.map(s => (
            <button key={s.key} type="button" onClick={() => setStance(s.key)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                stance === s.key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
              }`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={labelCls}>摘要</label>
        <textarea
          className="min-h-[120px] w-full rounded-lg border border-slate-200 p-3 text-sm focus:border-indigo-400 focus:outline-none resize-y"
          value={summary} onChange={e => setSummary(e.target.value)}
          placeholder="這份研報/新聞的核心觀點 300–500 字…" />
      </div>

      <div>
        <label className={labelCls}>重點條列(一行一個)</label>
        <textarea
          className="min-h-[100px] w-full rounded-lg border border-slate-200 p-3 text-sm focus:border-indigo-400 focus:outline-none resize-y"
          value={keyPointsText} onChange={e => setKeyPointsText(e.target.value)}
          placeholder={'先進製程 2026 全年滿載\n車用需求 Q2 回溫\n資本支出上修至 420 億美元'} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-slate-500">標籤</label>
          <button type="button" onClick={addTag} className="text-xs text-indigo-600 hover:underline">＋ 加標籤</button>
        </div>
        {tags.length === 0 && (
          <p className="text-xs text-slate-400">還沒有標籤。標個股代號、產業、主題,之後查詢與多券商對比都靠它。</p>
        )}
        <div className="space-y-2">
          {tags.map((row, i) => (
            <div key={i} className="flex gap-2 items-center">
              <select
                value={row.category}
                onChange={e => updateTag(i, { category: e.target.value as TagCategory })}
                className="h-9 rounded-lg border border-slate-200 px-2 text-sm focus:border-indigo-400 focus:outline-none"
              >
                {TAG_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <input
                value={row.name}
                onChange={e => updateTag(i, { name: e.target.value })}
                list={`tags-${row.category}`}
                placeholder="例:台積電 / 半導體 / AI"
                className="h-9 flex-1 rounded-lg border border-slate-200 px-3 text-sm focus:border-indigo-400 focus:outline-none"
              />
              <button type="button" onClick={() => removeTag(i)}
                className="h-9 w-9 rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50">✕</button>
            </div>
          ))}
        </div>
        {TAG_CATEGORIES.map(c => (
          <datalist key={c.key} id={`tags-${c.key}`}>
            {existingTags.filter(t => t.category === c.key).map(t => (
              <option key={t.id} value={t.name} />
            ))}
          </datalist>
        ))}
      </div>

      {/* 關聯客戶 */}
      <div>
        <label className="text-xs font-medium text-slate-500">關聯客戶</label>
        <p className="text-xs text-slate-400 mt-0.5 mb-2">
          這則情報跟哪些客戶有關(可拿去聊)。AI 建議的已自動帶入,可改可刪。
        </p>

        {links.length > 0 && (
          <div className="space-y-2 mb-2">
            {links.map(l => {
              const d = dealById.get(l.deal_id);
              return (
                <div key={l.deal_id} className="border border-slate-200 rounded-lg p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-800">
                      {d ? d.name : '(無權限或已不存在的客戶)'}
                      {d && <span className="text-xs text-slate-400 ml-2">商品:{d.product || '未定'} · {d.stage}</span>}
                    </span>
                    <button type="button" onClick={() => removeLink(l.deal_id)}
                      className="text-xs text-slate-400 hover:text-rose-600">移除</button>
                  </div>
                  <input
                    value={l.relevance_reason}
                    onChange={e => updateLinkReason(l.deal_id, e.target.value)}
                    placeholder="為什麼跟這客戶相關(可拿這則去聊什麼)"
                    className="h-8 w-full rounded-md border border-slate-200 px-2 text-xs focus:border-indigo-400 focus:outline-none"
                  />
                </div>
              );
            })}
          </div>
        )}

        <input
          value={dealSearch}
          onChange={e => setDealSearch(e.target.value)}
          placeholder="🔍 搜尋客戶名稱 / 商品來加入關聯…"
          className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-indigo-400 focus:outline-none"
        />
        {searchResults.length > 0 && (
          <ul className="mt-1 border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-56 overflow-auto">
            {searchResults.map(d => (
              <li key={d.id}>
                <button type="button" onClick={() => addLink(d.id)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">
                  <span className="font-medium text-slate-800">{d.name}</span>
                  <span className="text-xs text-slate-400 ml-2">商品:{d.product || '未定'} · {d.stage}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {dealSearch.trim() && searchResults.length === 0 && (
          <p className="text-xs text-slate-400 mt-1">查無符合的客戶(或已全部加入)。</p>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="inline-flex items-center gap-1 px-5 h-10 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? '儲存中…' : mode === 'create' ? '建立情報' : '儲存變更'}
        </button>
        <button
          onClick={() => router.back()}
          disabled={saving}
          className="inline-flex items-center px-4 h-10 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          取消
        </button>
      </div>
    </div>
  );
}
