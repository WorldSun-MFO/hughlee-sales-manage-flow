'use client';

// V4 新增情報入口 — AI parse + 帶入 V4IntelForm
import { useState } from 'react';
import { Loader2, Sparkles, FileText, Link as LinkIcon } from 'lucide-react';
import type { MarketTag, DealLite, MarketParseDraft } from '@/lib/types';
import { cn } from '@/lib/v4/utils';
import { V4IntelForm } from './V4IntelForm';

export function V4MarketComposer({
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
  const [draftKey, setDraftKey] = useState(0);

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
      if (!res.ok) { setAiError(json.error ?? 'AI 解析失敗'); setParsing(false); return; }
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
      setDraftKey((k) => k + 1);
    } catch { setAiError('網路錯誤,請再試一次。'); }
    finally { setParsing(false); }
  }

  return (
    <div className="grid gap-4">
      {/* AI 解析面板 */}
      <section className="grid gap-3 rounded-md border border-cobalt/25 bg-cobalt/5 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <div className="inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cobalt" strokeWidth={2} />
            <span className="font-v4-serif text-base font-semibold text-cobalt">AI 一鍵解析</span>
          </div>
          <span className="font-v4-mono text-[10.5px] text-ink/55">Claude Opus 4.7 · 通常 10-30 秒</span>
        </div>
        <p className="text-xs leading-5 text-ink/65">
          貼研報 / 新聞原文或網址 → 自動填好下方欄位 + 建議關聯客戶(都可改)
        </p>

        <div className="flex gap-2">
          {(['text', 'url'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setInputMode(m)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition',
                inputMode === m
                  ? 'border-cobalt bg-cobalt text-paper'
                  : 'border-ink/15 bg-paper text-ink/65 hover:border-cobalt/40 hover:text-cobalt',
              )}>
              {m === 'text' ? <FileText className="h-3 w-3" strokeWidth={2} /> : <LinkIcon className="h-3 w-3" strokeWidth={2} />}
              {m === 'text' ? '貼文字' : '貼網址'}
            </button>
          ))}
        </div>

        {inputMode === 'text' ? (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="把券商研報 / 財經新聞 / 法說內容整段貼進來…"
            className="min-h-[140px] w-full resize-y rounded-md border border-cobalt/20 bg-paper p-3 text-sm leading-6 text-ink focus:border-cobalt/40 focus:outline-none"
          />
        ) : (
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://… (Bloomberg/財訊等付費牆網站可能抓不到,抓不到請改貼文字)"
            className="h-10 w-full rounded-md border border-cobalt/20 bg-paper px-3 text-sm text-ink focus:border-cobalt/40 focus:outline-none"
          />
        )}

        {aiError && (
          <div className="rounded-md border border-claret/30 bg-claret/5 px-3 py-2 text-sm text-claret">{aiError}</div>
        )}

        <div className="flex items-center gap-3">
          <button type="button" onClick={handleParse} disabled={parsing}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-paper transition',
              parsing ? 'bg-cobalt/40 cursor-not-allowed' : 'bg-cobalt hover:bg-cobalt/85',
            )}>
            {parsing
              ? <><Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> AI 解析中…</>
              : <><Sparkles className="h-4 w-4" strokeWidth={2} /> AI 解析</>}
          </button>
          {draft && (
            <span className="inline-flex items-center gap-1 font-v4-mono text-xs text-forest">
              <Sparkles className="h-3 w-3" strokeWidth={2} /> 已帶入下方表單,請檢查後再建立 ↓
            </span>
          )}
        </div>
      </section>

      <V4IntelForm
        key={draftKey}
        mode="create"
        draft={draft ?? undefined}
        existingTags={existingTags}
        deals={deals}
      />
    </div>
  );
}
