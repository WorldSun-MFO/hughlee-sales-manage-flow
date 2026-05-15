'use client';

import { useState } from 'react';
import type { MarketTag, DealLite, MarketParseDraft } from '@/lib/types';
import { IntelForm } from './IntelForm';

export function MarketComposer({
  existingTags,
  deals,
}: {
  existingTags: MarketTag[];
  deals: DealLite[];
}) {
  const [inputMode, setInputMode] = useState<'text' | 'url'>('text');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [parsing, setParsing] = useState(false);
  const [aiError, setAiError] = useState('');
  const [draft, setDraft] = useState<MarketParseDraft | null>(null);
  const [draftKey, setDraftKey] = useState(0);   // 換 key 強制 IntelForm 用新草稿重新初始化

  async function handleParse() {
    setAiError('');
    if (inputMode === 'text' && text.trim().length < 30) {
      setAiError('內文太短,請貼完整一點的研報/新聞。'); return;
    }
    if (inputMode === 'url' && !url.trim()) {
      setAiError('請輸入網址。'); return;
    }
    setParsing(true);
    try {
      const res = await fetch('/api/ai/market-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputMode === 'text' ? { text } : { url }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAiError(json.error ?? 'AI 解析失敗');
        setParsing(false);
        return;
      }
      const d = json.data;
      setDraft({
        title: d.title ?? '',
        region: d.region ?? 'TW',
        stance: d.stance ?? 'na',
        summary: d.summary ?? '',
        key_points: d.key_points ?? [],
        source_name: d.source_name ?? '',
        author: d.author ?? '',
        source_url: inputMode === 'url' ? url.trim() : '',
        tags: d.tags ?? [],
        suggested_deal_links: d.suggested_deal_links ?? [],
      });
      setDraftKey(k => k + 1);
    } catch {
      setAiError('網路錯誤,請再試一次。');
    } finally {
      setParsing(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* AI 解析面板 */}
      <div className="bg-indigo-50/60 border border-indigo-200 rounded-2xl p-5 space-y-3 max-w-3xl">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-indigo-900">🤖 AI 一鍵解析</span>
          <span className="text-xs text-indigo-500">貼研報/新聞原文或網址 → 自動填好下方欄位 + 建議關聯客戶(都可改)</span>
        </div>

        <div className="flex gap-2 text-xs">
          {(['text', 'url'] as const).map(m => (
            <button key={m} type="button" onClick={() => setInputMode(m)}
              className={`px-3 py-1.5 rounded-lg border transition ${
                inputMode === m ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
              }`}>
              {m === 'text' ? '貼文字' : '貼網址'}
            </button>
          ))}
        </div>

        {inputMode === 'text' ? (
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="把券商研報 / 財經新聞 / 法說內容整段貼進來…"
            className="min-h-[140px] w-full rounded-lg border border-indigo-200 bg-white p-3 text-sm focus:border-indigo-400 focus:outline-none resize-y"
          />
        ) : (
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://… (Bloomberg/財訊等付費牆網站可能抓不到,抓不到請改貼文字)"
            className="h-10 w-full rounded-lg border border-indigo-200 bg-white px-3 text-sm focus:border-indigo-400 focus:outline-none"
          />
        )}

        {aiError && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-sm text-rose-700">{aiError}</div>
        )}

        <div className="flex items-center gap-3">
          <button type="button" onClick={handleParse} disabled={parsing}
            className="inline-flex items-center gap-1 px-4 h-10 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {parsing ? 'AI 解析中…(約 10-30 秒)' : '✨ AI 解析'}
          </button>
          {draft && <span className="text-xs text-emerald-600">已帶入下方表單,請檢查後再建立 ↓</span>}
        </div>
      </div>

      {/* 表單(AI 帶入或手動填,key 變動會用新草稿重建) */}
      <IntelForm
        key={draftKey}
        mode="create"
        draft={draft ?? undefined}
        existingTags={existingTags}
        deals={deals}
      />
    </div>
  );
}
