'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  MarketIntel, MarketTag,
  IntelRegion, IntelSourceType, IntelStance, TagCategory,
} from '@/lib/types';
import { REGIONS, SOURCE_TYPES, STANCES, TAG_CATEGORIES } from '@/lib/market/constants';

interface TagRow { category: TagCategory; name: string }

export function IntelForm({
  mode,
  initial,
  existingTags,
}: {
  mode: 'create' | 'edit';
  initial?: MarketIntel;
  existingTags: MarketTag[];
}) {
  const router = useRouter();

  const [title, setTitle] = useState(initial?.title ?? '');
  const [region, setRegion] = useState<IntelRegion>(initial?.region ?? 'TW');
  const [sourceType, setSourceType] = useState<IntelSourceType>(initial?.source_type ?? 'broker_research');
  const [sourceName, setSourceName] = useState(initial?.source_name ?? '');
  const [author, setAuthor] = useState(initial?.author ?? '');
  const [sourceUrl, setSourceUrl] = useState(initial?.source_url ?? '');
  const [publishedAt, setPublishedAt] = useState(initial?.published_at ?? '');
  const [stance, setStance] = useState<IntelStance>(initial?.stance ?? 'na');
  const [summary, setSummary] = useState(initial?.summary ?? '');
  const [keyPointsText, setKeyPointsText] = useState((initial?.key_points ?? []).join('\n'));
  const [tags, setTags] = useState<TagRow[]>(
    (initial?.tags ?? []).map(t => ({ category: t.category, name: t.name }))
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function addTag() {
    setTags(t => [...t, { category: 'ticker', name: '' }]);
  }
  function updateTag(i: number, patch: Partial<TagRow>) {
    setTags(t => t.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function removeTag(i: number) {
    setTags(t => t.filter((_, idx) => idx !== i));
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
      tags: tags
        .map(t => ({ category: t.category, name: t.name.trim() }))
        .filter(t => t.name),
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
        <label className={labelCls}>摘要(Phase 2 之後可改用 AI 一鍵生成)</label>
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
        {/* 既有標籤建議(依分類) */}
        {TAG_CATEGORIES.map(c => (
          <datalist key={c.key} id={`tags-${c.key}`}>
            {existingTags.filter(t => t.category === c.key).map(t => (
              <option key={t.id} value={t.name} />
            ))}
          </datalist>
        ))}
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
