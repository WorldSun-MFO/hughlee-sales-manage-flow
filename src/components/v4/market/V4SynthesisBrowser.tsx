'use client';

// V4 多空綜合 — 同 SynthesisBrowser API,v4 視覺
import { useMemo, useState } from 'react';
import { Loader2, Scale, TrendingDown, TrendingUp, Sparkles, Eye, AlertTriangle, Briefcase } from 'lucide-react';
import type { MarketTag } from '@/lib/types';
import type { MarketSynthesisResponse } from '@/lib/anthropic/schemas';
import { TAG_CATEGORIES } from '@/lib/market/constants';
import { cn } from '@/lib/v4/utils';

const STANCE_BADGE: Record<string, { label: string; cls: string; Icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }> = {
  bullish: { label: '綜合偏多', cls: 'border-forest/40 bg-forest/10 text-forest', Icon: TrendingUp },
  bearish: { label: '綜合偏空', cls: 'border-claret/40 bg-claret/10 text-claret', Icon: TrendingDown },
  neutral: { label: '綜合中性', cls: 'border-brass/40 bg-brass/10 text-brass', Icon: Scale },
  mixed:   { label: '多空分歧', cls: 'border-cobalt/40 bg-cobalt/10 text-cobalt', Icon: AlertTriangle },
};

export function V4SynthesisBrowser({ tags }: { tags: MarketTag[] }) {
  const [tagId, setTagId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<MarketSynthesisResponse | null>(null);
  const [intelCount, setIntelCount] = useState(0);

  const grouped = useMemo(() => {
    return TAG_CATEGORIES.map((c) => ({
      category: c,
      items: tags.filter((t) => t.category === c.key),
    })).filter((g) => g.items.length > 0);
  }, [tags]);

  const selectedTag = tags.find((t) => t.id === tagId);

  async function run() {
    if (!tagId) { setError('請先選一個標的'); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await fetch('/api/ai/market-synthesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? '綜合失敗'); setLoading(false); return; }
      setResult(json.data as MarketSynthesisResponse);
      setIntelCount(json.intel_count ?? 0);
    } catch { setError('網路錯誤,請再試一次'); }
    finally { setLoading(false); }
  }

  const badge = result ? STANCE_BADGE[result.consensus_stance] ?? STANCE_BADGE.mixed : null;

  return (
    <div className="grid gap-4">
      {/* 選擇 + 觸發 */}
      <section className="grid gap-3 rounded-md border border-ink/10 bg-paper p-5">
        <span className="label-caps text-ink/55">選一個標的(個股 / 產業 / 主題)</span>
        <div className="flex flex-wrap gap-2">
          <select
            value={tagId}
            onChange={(e) => setTagId(e.target.value)}
            className="h-10 min-w-[220px] flex-1 rounded-md border border-ink/15 bg-cream/40 px-3 text-sm text-ink focus:border-ink/40 focus:outline-none"
          >
            <option value="">— 請選擇 —</option>
            {grouped.map((g) => (
              <optgroup key={g.category.key} label={g.category.label}>
                {g.items.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            onClick={run}
            disabled={loading || !tagId}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-paper transition',
              loading || !tagId ? 'bg-ink/30 cursor-not-allowed' : 'bg-ink hover:bg-graphite',
            )}
          >
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> AI 綜合中…</>
              : <><Scale className="h-4 w-4" strokeWidth={2} /> AI 綜合分析</>}
          </button>
        </div>
        {tags.length === 0 && (
          <p className="font-v4-mono text-xs text-ink/45">還沒有任何標籤。先去市場大腦建幾筆有標籤的情報。</p>
        )}
        <p className="font-v4-mono text-[10.5px] text-ink/45">
          用 Claude Opus 4.7 即時把多家觀點綜合,有 API 成本。內部判斷參考,非客戶話術。約 15-40 秒。
        </p>
      </section>

      {error && (
        <div className="rounded-md border border-claret/30 bg-claret/5 px-3 py-2 text-sm text-claret">{error}</div>
      )}

      {result && badge && (
        <section className="grid gap-5 rounded-md border border-ink/10 bg-paper p-6">
          {/* Header */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-v4-serif text-xl font-semibold text-ink">{selectedTag?.name}</span>
            <span className={cn('inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-v4-mono text-xs font-bold', badge.cls)}>
              <badge.Icon className="h-3 w-3" strokeWidth={2} />
              {badge.label}
            </span>
            <span className="font-v4-mono text-[11px] text-ink/45 numeric">依據 {intelCount} 筆情報綜合</span>
          </div>

          <p className="whitespace-pre-wrap text-sm leading-7 text-ink/85">{result.summary}</p>

          {/* 多空對照 */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-forest/30 bg-forest/5 p-3">
              <div className="mb-2 inline-flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-forest" strokeWidth={2} />
                <span className="label-caps text-forest">多方論點</span>
              </div>
              {result.bull_points.length === 0 ? (
                <p className="font-v4-mono text-xs text-ink/45">(無)</p>
              ) : (
                <ul className="grid gap-1.5">
                  {result.bull_points.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-ink/85">
                      <span className="mt-1.5 grid h-1 w-1 shrink-0 rounded-full bg-forest" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-md border border-claret/30 bg-claret/5 p-3">
              <div className="mb-2 inline-flex items-center gap-1.5">
                <TrendingDown className="h-3.5 w-3.5 text-claret" strokeWidth={2} />
                <span className="label-caps text-claret">空方論點</span>
              </div>
              {result.bear_points.length === 0 ? (
                <p className="font-v4-mono text-xs text-ink/45">(無)</p>
              ) : (
                <ul className="grid gap-1.5">
                  {result.bear_points.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-ink/85">
                      <span className="mt-1.5 grid h-1 w-1 shrink-0 rounded-full bg-claret" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="grid gap-1.5">
            <div className="inline-flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 text-brass" strokeWidth={2} />
              <span className="label-caps text-brass">關鍵分歧</span>
            </div>
            <p className="text-sm leading-6 text-ink/85">{result.divergence}</p>
          </div>

          {result.watch_items.length > 0 && (
            <div className="grid gap-1.5">
              <div className="inline-flex items-center gap-1.5">
                <Eye className="h-3 w-3 text-ink/55" strokeWidth={2} />
                <span className="label-caps text-ink/55">接下來盯什麼</span>
              </div>
              <ul className="grid gap-1.5">
                {result.watch_items.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-ink/85">
                    <span className="mt-1.5 grid h-1 w-1 shrink-0 rounded-full bg-ink/40" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-1.5 rounded-md border border-cobalt/25 bg-cobalt/5 p-3">
            <div className="inline-flex items-center gap-1.5">
              <Briefcase className="h-3 w-3 text-cobalt" strokeWidth={2} />
              <span className="label-caps text-cobalt">對我們客戶的意涵</span>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-ink/85">{result.wsg_implication}</p>
          </div>

          <footer className="border-t border-ink/8 pt-3 font-v4-mono text-[10.5px] text-ink/45 inline-flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-cobalt" strokeWidth={2} />
            Claude Opus 4.7 即時運算
          </footer>
        </section>
      )}
    </div>
  );
}
