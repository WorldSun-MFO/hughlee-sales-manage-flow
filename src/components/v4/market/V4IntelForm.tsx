'use client';

// ============================================================
// V4 情報編輯表單 — 取代既有 IntelForm,套 v4 視覺
// ============================================================
// 功能與 IntelForm.tsx 1:1 對應(同 API:POST /api/market/intel
// 或 PATCH /api/market/intel/[id]),只差視覺重繪。
// ============================================================
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Plus, Search, X } from 'lucide-react';
import type {
  MarketIntel, MarketTag, DealLite, MarketParseDraft,
  IntelRegion, IntelSourceType, IntelStance, TagCategory,
} from '@/lib/types';
import { REGIONS, SOURCE_TYPES, STANCES, TAG_CATEGORIES } from '@/lib/market/constants';
import { cn } from '@/lib/v4/utils';

interface TagRow { category: TagCategory; name: string }
interface LinkRow { deal_id: string; relevance_reason: string }

const STANCE_TONE: Record<IntelStance, { active: string; inactive: string }> = {
  bullish: { active: 'bg-forest text-paper border-forest', inactive: 'text-forest border-forest/30 hover:bg-forest/8' },
  bearish: { active: 'bg-claret text-paper border-claret', inactive: 'text-claret border-claret/30 hover:bg-claret/8' },
  neutral: { active: 'bg-brass text-paper border-brass', inactive: 'text-brass border-brass/30 hover:bg-brass/8' },
  na:      { active: 'bg-ink text-paper border-ink', inactive: 'text-ink/65 border-ink/15 hover:bg-ink/5' },
};

export function V4IntelForm({
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
    (initial?.key_points ?? draft?.key_points ?? []).join('\n'),
  );
  const [tags, setTags] = useState<TagRow[]>(
    (initial?.tags ?? draft?.tags ?? []).map((t) => ({ category: t.category, name: t.name })),
  );
  const [links, setLinks] = useState<LinkRow[]>(() => {
    if (initial?.deal_links?.length) {
      return initial.deal_links.map((l) => ({ deal_id: l.deal_id, relevance_reason: l.relevance_reason }));
    }
    if (draft?.suggested_deal_links?.length) {
      return draft.suggested_deal_links.map((l) => ({ deal_id: l.deal_id, relevance_reason: l.relevance_reason }));
    }
    return [];
  });
  const [dealSearch, setDealSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const dealById = useMemo(() => {
    const m = new Map<string, DealLite>();
    deals.forEach((d) => m.set(d.id, d));
    return m;
  }, [deals]);

  const linkedIds = useMemo(() => new Set(links.map((l) => l.deal_id)), [links]);
  const searchResults = useMemo(() => {
    const kw = dealSearch.trim().toLowerCase();
    if (!kw) return [];
    return deals
      .filter((d) => !linkedIds.has(d.id))
      .filter((d) => `${d.name} ${d.product ?? ''}`.toLowerCase().includes(kw))
      .slice(0, 20);
  }, [deals, dealSearch, linkedIds]);

  function addTag() { setTags((t) => [...t, { category: 'ticker', name: '' }]); }
  function updateTag(i: number, patch: Partial<TagRow>) {
    setTags((t) => t.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function removeTag(i: number) { setTags((t) => t.filter((_, idx) => idx !== i)); }
  function addLink(deal_id: string) {
    setLinks((l) => (l.some((x) => x.deal_id === deal_id) ? l : [...l, { deal_id, relevance_reason: '' }]));
    setDealSearch('');
  }
  function updateLinkReason(deal_id: string, reason: string) {
    setLinks((l) => l.map((x) => (x.deal_id === deal_id ? { ...x, relevance_reason: reason } : x)));
  }
  function removeLink(deal_id: string) {
    setLinks((l) => l.filter((x) => x.deal_id !== deal_id));
  }

  async function handleSubmit() {
    if (!title.trim()) { setError('請填標題'); return; }
    setSaving(true); setError('');

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
      key_points: keyPointsText.split('\n').map((s) => s.trim()).filter(Boolean),
      tags: tags.map((t) => ({ category: t.category, name: t.name.trim() })).filter((t) => t.name),
      deal_links: links
        .filter((l) => l.deal_id)
        .map((l) => ({ deal_id: l.deal_id, relevance_reason: l.relevance_reason.trim() })),
    };

    const url = mode === 'create' ? '/api/market/intel' : `/api/market/intel/${initial!.id}`;
    const method = mode === 'create' ? 'POST' : 'PATCH';
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? '儲存失敗'); setSaving(false); return; }
      const id = mode === 'create' ? json.data.id : initial!.id;
      router.push(`/market/${id}` as never);
      router.refresh();
    } catch { setError('網路錯誤,請再試一次'); setSaving(false); }
  }

  const inputCls = 'h-10 w-full rounded-md border border-ink/15 bg-cream/40 px-3 text-sm text-ink focus:border-ink/40 focus:outline-none';

  return (
    <div className="grid gap-5 rounded-md border border-ink/10 bg-paper p-5">
      {error && (
        <div className="rounded-md border border-claret/30 bg-claret/5 px-3 py-2 text-sm text-claret">{error}</div>
      )}

      <Field label="標題 *">
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="例:台積電 2026Q1 法說重點 — 先進製程滿載" />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="市場地區">
          <select className={inputCls} value={region} onChange={(e) => setRegion(e.target.value as IntelRegion)}>
            {REGIONS.map((r) => <option key={r.key} value={r.key}>{r.flag} {r.label}</option>)}
          </select>
        </Field>
        <Field label="來源類型">
          <select className={inputCls} value={sourceType} onChange={(e) => setSourceType(e.target.value as IntelSourceType)}>
            {SOURCE_TYPES.map((s) => <option key={s.key} value={s.key}>{s.emoji} {s.label}</option>)}
          </select>
        </Field>
        <Field label="來源名稱(哪一家)">
          <input className={inputCls} value={sourceName} onChange={(e) => setSourceName(e.target.value)}
            placeholder="例:摩根士丹利 / 日經新聞 / TWSE" />
        </Field>
        <Field label="分析師 / 作者">
          <input className={inputCls} value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="可留白" />
        </Field>
        <Field label="原文連結">
          <input className={inputCls} value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://… (可留白)" />
        </Field>
        <Field label="原文發布日">
          <input type="date" className={cn(inputCls, 'font-v4-mono')} value={publishedAt ?? ''} onChange={(e) => setPublishedAt(e.target.value)} />
        </Field>
      </div>

      <Field label="立場">
        <div className="flex gap-2">
          {STANCES.map((s) => {
            const tone = STANCE_TONE[s.key];
            return (
              <button key={s.key} type="button" onClick={() => setStance(s.key)}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-sm font-semibold transition',
                  stance === s.key ? tone.active : `bg-paper ${tone.inactive}`,
                )}>
                {s.label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="摘要">
        <textarea
          className="min-h-[120px] w-full resize-y rounded-md border border-ink/15 bg-cream/40 p-3 text-sm leading-6 text-ink focus:border-ink/40 focus:outline-none"
          value={summary} onChange={(e) => setSummary(e.target.value)}
          placeholder="這份研報/新聞的核心觀點 300–500 字…" />
      </Field>

      <Field label="重點條列(一行一個)">
        <textarea
          className="min-h-[100px] w-full resize-y rounded-md border border-ink/15 bg-cream/40 p-3 text-sm leading-6 text-ink focus:border-ink/40 focus:outline-none"
          value={keyPointsText} onChange={(e) => setKeyPointsText(e.target.value)}
          placeholder={'先進製程 2026 全年滿載\n車用需求 Q2 回溫\n資本支出上修至 420 億美元'} />
      </Field>

      {/* 標籤 */}
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <span className="label-caps text-ink/55">標籤</span>
          <button type="button" onClick={addTag} className="inline-flex items-center gap-1 font-v4-mono text-xs font-semibold text-cobalt hover:underline">
            <Plus className="h-3 w-3" strokeWidth={2.5} /> 加標籤
          </button>
        </div>
        {tags.length === 0 && (
          <p className="font-v4-mono text-[11px] text-ink/45">還沒有標籤。標個股代號、產業、主題,之後查詢與多券商對比都靠它。</p>
        )}
        <div className="grid gap-2">
          {tags.map((row, i) => (
            <div key={i} className="grid grid-cols-[120px_1fr_36px] items-center gap-2">
              <select
                value={row.category}
                onChange={(e) => updateTag(i, { category: e.target.value as TagCategory })}
                className="h-9 rounded-md border border-ink/15 bg-paper px-2 text-sm text-ink focus:border-ink/40 focus:outline-none"
              >
                {TAG_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <input
                value={row.name}
                onChange={(e) => updateTag(i, { name: e.target.value })}
                list={`tags-${row.category}`}
                placeholder="例:台積電 / 半導體 / AI"
                className="h-9 rounded-md border border-ink/15 bg-cream/40 px-3 text-sm text-ink focus:border-ink/40 focus:outline-none"
              />
              <button type="button" onClick={() => removeTag(i)}
                className="grid h-9 w-9 place-items-center rounded-md border border-ink/15 text-ink/40 hover:bg-claret/8 hover:text-claret hover:border-claret/30 transition">
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
        {TAG_CATEGORIES.map((c) => (
          <datalist key={c.key} id={`tags-${c.key}`}>
            {existingTags.filter((t) => t.category === c.key).map((t) => (
              <option key={t.id} value={t.name} />
            ))}
          </datalist>
        ))}
      </div>

      {/* 關聯客戶 */}
      <div className="grid gap-2">
        <div>
          <span className="label-caps text-ink/55">關聯客戶</span>
          <p className="mt-0.5 font-v4-mono text-[11px] text-ink/45">
            這則情報跟哪些客戶有關(可拿去聊)。AI 建議的已自動帶入,可改可刪。
          </p>
        </div>

        {links.length > 0 && (
          <div className="grid gap-2">
            {links.map((l) => {
              const d = dealById.get(l.deal_id);
              return (
                <div key={l.deal_id} className="grid gap-1.5 rounded-md border border-ink/10 bg-cream/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">
                      {d ? d.name : '(無權限或已不存在的客戶)'}
                      {d && <span className="ml-2 font-v4-mono text-[11px] font-normal text-ink/55">商品:{d.product || '未定'} · {d.stage}</span>}
                    </span>
                    <button type="button" onClick={() => removeLink(l.deal_id)}
                      className="font-v4-mono text-[11px] text-ink/45 hover:text-claret">移除</button>
                  </div>
                  <input
                    value={l.relevance_reason}
                    onChange={(e) => updateLinkReason(l.deal_id, e.target.value)}
                    placeholder="為什麼跟這客戶相關(可拿這則去聊什麼)"
                    className="h-8 rounded-sm border border-ink/15 bg-paper px-2 text-xs text-ink focus:border-ink/40 focus:outline-none"
                  />
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2 rounded-md border border-ink/15 bg-cream/40 px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-ink/45" strokeWidth={1.75} />
          <input
            value={dealSearch}
            onChange={(e) => setDealSearch(e.target.value)}
            placeholder="搜尋客戶名稱 / 商品來加入關聯…"
            className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink/40"
          />
        </div>
        {searchResults.length > 0 && (
          <ul className="grid divide-y divide-ink/8 overflow-hidden rounded-md border border-ink/15 bg-paper">
            {searchResults.map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => addLink(d.id)}
                  className="w-full text-left px-3 py-2 text-sm transition hover:bg-cream/60">
                  <span className="font-semibold text-ink">{d.name}</span>
                  <span className="ml-2 font-v4-mono text-[11px] text-ink/55">商品:{d.product || '未定'} · {d.stage}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {dealSearch.trim() && searchResults.length === 0 && (
          <p className="font-v4-mono text-[11px] text-ink/45">查無符合的客戶(或已全部加入)。</p>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-ink/10 pt-4">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-md bg-ink px-5 py-2 text-sm font-semibold text-paper transition hover:bg-graphite disabled:cursor-not-allowed disabled:bg-ink/30"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : <Check className="h-4 w-4" strokeWidth={2} />}
          {saving ? '儲存中…' : mode === 'create' ? '建立情報' : '儲存變更'}
        </button>
        <button
          onClick={() => router.back()}
          disabled={saving}
          className="rounded-md border border-ink/15 bg-paper px-4 py-2 text-sm text-ink/75 transition hover:border-ink/30 hover:text-ink disabled:opacity-50"
        >
          取消
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="label-caps text-ink/55">{label}</span>
      {children}
    </label>
  );
}
