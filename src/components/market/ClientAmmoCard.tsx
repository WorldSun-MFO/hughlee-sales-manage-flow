'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ClientAmmoResponse } from '@/lib/anthropic/schemas';
import type { IntelLinkSuggestion } from '@/lib/types';
import { STANCE_LABEL, STANCE_STYLE } from '@/lib/market/constants';

export function ClientAmmoCard({ dealId, dealName }: { dealId: string; dealName: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ClientAmmoResponse | null>(null);

  const [suggestions, setSuggestions] = useState<IntelLinkSuggestion[]>([]);
  const [suggLoaded, setSuggLoaded] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  // 卡片展開時載入待審配對建議(零 AI 成本)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/market/suggestions?dealId=${encodeURIComponent(dealId)}`);
        const json = await res.json();
        if (!cancelled && res.ok) setSuggestions((json.data ?? []) as IntelLinkSuggestion[]);
      } catch {
        /* 靜默:建議載入失敗不擋彈藥庫主功能 */
      } finally {
        if (!cancelled) setSuggLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [open, dealId]);

  async function decide(id: string, action: 'accept' | 'dismiss') {
    setActing(id);
    try {
      const res = await fetch(`/api/market/suggestions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) setSuggestions(s => s.filter(x => x.id !== id));
    } catch {
      /* 失敗就保留,讓使用者再試 */
    } finally {
      setActing(null);
    }
  }

  async function generate() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ai/client-talking-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? '產生失敗');
        setLoading(false);
        return;
      }
      setResult(json.data as ClientAmmoResponse);
    } catch {
      setError('網路錯誤,請再試一次');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white rounded-lg p-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          🧠 市場彈藥庫 — 今天能跟 {dealName} 聊什麼
          {suggLoaded && suggestions.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-600">
              {suggestions.length} 筆待審
            </span>
          )}
        </span>
        <span className="text-xs text-slate-400">{open ? '收合 ▲' : '展開 ▼'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* 待審配對建議(自動進件 AI 配的,RM 審核) */}
          {suggestions.length > 0 && (
            <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-2.5 space-y-2">
              <div className="text-xs font-semibold text-rose-700">
                📥 待審配對建議({suggestions.length})— 自動抓取 AI 認為這些情報跟此客戶有關
              </div>
              {suggestions.map(s => (
                <div key={s.id} className="bg-white rounded-lg border border-slate-200 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/market/${s.intel_id}`}
                      target="_blank"
                      className="text-sm font-medium text-slate-800 hover:text-indigo-600 hover:underline flex-1 min-w-0"
                    >
                      {s.intel?.title ?? '(情報已不存在)'}
                    </Link>
                    {s.intel && (
                      <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full ${STANCE_STYLE[s.intel.stance]}`}>
                        {STANCE_LABEL[s.intel.stance]}
                      </span>
                    )}
                  </div>
                  {s.relevance_reason && (
                    <div className="text-xs text-slate-500 mt-1">{s.relevance_reason}</div>
                  )}
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={acting === s.id}
                      onClick={() => decide(s.id, 'accept')}
                      className="px-2.5 h-7 text-xs rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {acting === s.id ? '處理中…' : '✓ 採納關聯'}
                    </button>
                    <button
                      type="button"
                      disabled={acting === s.id}
                      onClick={() => decide(s.id, 'dismiss')}
                      className="px-2.5 h-7 text-xs rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                    >
                      忽略
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!result && (
            <div className="flex items-center gap-3">
              <button
                onClick={generate}
                disabled={loading}
                className="inline-flex items-center gap-1 px-3 h-9 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'AI 分析中…(約 10-30 秒)' : '✨ 產生今日可聊話題'}
              </button>
              <span className="text-[11px] text-slate-400">用 Opus 4.7 即時綜合情報庫,有 API 成本</span>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-sm text-rose-700">{error}</div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="text-xs text-slate-600 bg-white/70 rounded-lg p-2.5 border border-slate-200">
                {result.overall}
              </div>

              {result.talking_points.length === 0 ? (
                <p className="text-xs text-slate-400">目前情報庫沒有特別貼切這位客戶的話題。先去市場大腦多累積情報,或之後再產生。</p>
              ) : (
                <ul className="space-y-2">
                  {result.talking_points.map((tp, i) => {
                    const lines = tp.opener.split('\n').map(s => s.trim()).filter(Boolean);
                    return (
                      <li key={i} className="bg-white rounded-lg border border-slate-200 p-3">
                        <div className="text-sm font-semibold text-slate-900">💬 {tp.hook}</div>
                        <div className="text-xs text-slate-500 mt-1">{tp.angle}</div>

                        {tp.caution ? (
                          <div className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-300 rounded px-2.5 py-2">
                            ⚠️ 建議 Hugh 親自確認 / 手寫:{tp.caution}
                          </div>
                        ) : null}

                        <div className="mt-2 flex flex-col gap-1">
                          {lines.map((line, j) => (
                            <div key={j}
                              className="self-start max-w-[85%] text-sm text-slate-800 bg-emerald-50 border border-emerald-200 rounded-2xl rounded-bl-sm px-3 py-1.5">
                              {line}
                            </div>
                          ))}
                        </div>

                        <div className="mt-2 text-[11px] flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => navigator.clipboard?.writeText(lines.join('\n'))}
                            className="text-slate-500 hover:text-indigo-600"
                          >
                            📋 複製訊息
                          </button>
                          <Link href={`/market/${tp.intel_id}`} target="_blank"
                            className="text-indigo-600 hover:underline">
                            📄 依據:{tp.intel_title}
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <button
                onClick={generate}
                disabled={loading}
                className="text-xs text-indigo-600 hover:underline disabled:opacity-50"
              >
                {loading ? '重新分析中…' : '↻ 重新產生'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
