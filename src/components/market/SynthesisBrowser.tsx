'use client';

import { useMemo, useState } from 'react';
import type { MarketTag } from '@/lib/types';
import type { MarketSynthesisResponse } from '@/lib/anthropic/schemas';
import { TAG_CATEGORIES } from '@/lib/market/constants';

const STANCE_BADGE: Record<string, { label: string; cls: string }> = {
  bullish: { label: '綜合偏多', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  bearish: { label: '綜合偏空', cls: 'bg-rose-100 text-rose-700 border-rose-200' },
  neutral: { label: '綜合中性', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  mixed: { label: '多空分歧', cls: 'bg-violet-100 text-violet-700 border-violet-200' },
};

export function SynthesisBrowser({ tags }: { tags: MarketTag[] }) {
  const [tagId, setTagId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<MarketSynthesisResponse | null>(null);
  const [intelCount, setIntelCount] = useState(0);

  // 依分類分組(個股優先)
  const grouped = useMemo(() => {
    return TAG_CATEGORIES.map(c => ({
      category: c,
      items: tags.filter(t => t.category === c.key),
    })).filter(g => g.items.length > 0);
  }, [tags]);

  const selectedTag = tags.find(t => t.id === tagId);

  async function run() {
    if (!tagId) { setError('請先選一個標的'); return; }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/ai/market-synthesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? '綜合失敗');
        setLoading(false);
        return;
      }
      setResult(json.data as MarketSynthesisResponse);
      setIntelCount(json.intel_count ?? 0);
    } catch {
      setError('網路錯誤,請再試一次');
    } finally {
      setLoading(false);
    }
  }

  const badge = result ? STANCE_BADGE[result.consensus_stance] ?? STANCE_BADGE.mixed : null;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <label className="block text-xs font-medium text-slate-500">選一個標的(個股 / 產業 / 主題)</label>
        <div className="flex flex-wrap gap-2">
          <select
            value={tagId}
            onChange={e => setTagId(e.target.value)}
            className="h-10 flex-1 min-w-[220px] rounded-lg border border-slate-200 px-3 text-sm focus:border-indigo-400 focus:outline-none"
          >
            <option value="">— 請選擇 —</option>
            {grouped.map(g => (
              <optgroup key={g.category.key} label={g.category.label}>
                {g.items.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            onClick={run}
            disabled={loading || !tagId}
            className="inline-flex items-center gap-1 px-4 h-10 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'AI 綜合中…(約 15-40 秒)' : '📊 AI 綜合分析'}
          </button>
        </div>
        {tags.length === 0 && (
          <p className="text-xs text-slate-400">還沒有任何標籤。先去市場大腦建幾筆有標籤的情報。</p>
        )}
        <p className="text-[11px] text-slate-400">用 Opus 4.7 即時把多家觀點綜合,有 API 成本。內部判斷參考,非客戶話術。</p>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">{error}</div>
      )}

      {result && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-lg font-bold text-slate-900">{selectedTag?.name}</span>
            {badge && (
              <span className={`text-xs px-2.5 py-1 rounded-full border ${badge.cls}`}>{badge.label}</span>
            )}
            <span className="text-xs text-slate-400">依據 {intelCount} 筆情報綜合</span>
          </div>

          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{result.summary}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
              <div className="text-xs font-semibold text-emerald-700 mb-1.5">📈 多方論點</div>
              {result.bull_points.length === 0 ? (
                <p className="text-xs text-slate-400">(無)</p>
              ) : (
                <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
                  {result.bull_points.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              )}
            </div>
            <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3">
              <div className="text-xs font-semibold text-rose-700 mb-1.5">📉 空方論點</div>
              {result.bear_points.length === 0 ? (
                <p className="text-xs text-slate-400">(無)</p>
              ) : (
                <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
                  {result.bear_points.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              )}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-500 mb-1">⚔️ 關鍵分歧</div>
            <p className="text-sm text-slate-700">{result.divergence}</p>
          </div>

          {result.watch_items.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-1">👀 接下來盯什麼</div>
              <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
                {result.watch_items.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}

          <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-3">
            <div className="text-xs font-semibold text-indigo-700 mb-1">💼 對我們客戶的意涵</div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{result.wsg_implication}</p>
          </div>
        </div>
      )}
    </div>
  );
}
