'use client';

// ============================================================
// 單一客戶的 AI 助手面板 — 給 ClientDetailView 的 Drawer 用
// ============================================================
// 跟 AIChatView 的差異:
//   - AIChatView:左側案件列表 + 右側操作。整頁。
//   - 這支:沒有案件列表(已知 deal),只剩操作 UI。給 Drawer 嵌入用。
//
// 接的後端跟 AIChatView 完全一樣:POST /api/ai/parse-interaction
// ============================================================
import { useState } from 'react';
import { Sparkles, ArrowUp, Lightbulb } from 'lucide-react';
import type { Deal, StageId } from '@/lib/v4/types';
import { fmtMoney, cn } from '@/lib/v4/utils';
import { STAGES } from '@/lib/v4/constants';
import { AttachmentTray } from '@/components/v4/AttachmentTray';
import type { UploadedAttachment } from '@/lib/v4/upload';

interface ScoreUpdate { field: string; old: number; new: number; reason: string }
interface ParseResult {
  summary: string;
  score_updates: ScoreUpdate[];
  new_comment: string;
  next_step_update: string | null;
  question_checkoffs: string[];
  stage_suggestion: StageId | null;
  ask_back: string[];
}

const SCORE_LABEL: Record<string, string> = {
  m: 'M — Metrics', e: 'E — Economic Buyer', d1: 'D₁ — Decision Criteria', d2: 'D₂ — Decision Process',
  p: 'P — Paper Process', i: 'I — Identify Pain', c1: 'C₁ — Champion', c2: 'C₂ — Competition',
};

export function DealAIPanel({ deal, isFixtures }: { deal: Deal; isFixtures: boolean }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);

  async function analyze() {
    if (!text.trim() || busy) return;
    if (isFixtures) { setError('目前是 fixtures 模式(未接 Supabase),AI 分析需要登入 + 真實案件'); return; }
    setBusy(true); setError(null); setResult(null);
    try {
      const res = await fetch('/api/ai/parse-interaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id, userText: text.trim() }),
      });
      const raw = await res.text();
      let json: { data?: ParseResult; error?: string };
      try { json = JSON.parse(raw); } catch { throw new Error(`回應格式錯誤(HTTP ${res.status})`); }
      if (!res.ok) throw new Error(json.error || '解析失敗');
      if (!json.data) throw new Error('AI 沒有回傳資料');
      setResult(json.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const stageName = STAGES.find((s) => s.id === deal.stage)?.name;

  return (
    <div className="grid gap-5">
      {/* 客戶 context 列(精簡版,因為 Drawer 標題已寫 AI 助手)*/}
      <div className="grid gap-1.5 rounded-md border border-ink/10 bg-cream/40 p-4">
        <div className="label-caps text-ink/55">針對</div>
        <div className="font-v4-serif text-xl font-semibold text-ink">{deal.name}</div>
        <div className="font-v4-mono text-[11px] text-ink/55 numeric">
          {fmtMoney(Number(deal.aum_usd))} · {deal.stage}{stageName ? ` · ${stageName}` : ''} · Tier {deal.tier ?? '—'}
        </div>
      </div>

      {/* 輸入區 */}
      <section className="grid gap-3 rounded-md border border-ink/10 bg-paper p-5">
        <label className="grid gap-2">
          <span className="label-caps text-ink/55">這次的互動描述</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder="例如:今天下午打電話給陳先生,他說他考慮加碼到 300 萬美金,但太太還沒點頭。下週三要一起吃晚餐讓我見太太。他擔心銀行抽銀根,問我宏利財摯宏耀有沒有 Margin Call 條款..."
            className="w-full resize-vertical rounded-md border border-ink/12 bg-cream/40 px-3.5 py-3 text-sm leading-6 text-ink placeholder:text-ink/40 focus:border-ink/30 focus:outline-none"
            disabled={busy}
          />
        </label>

        <AttachmentTray
          dealId={deal.id}
          isFixtures={isFixtures}
          attachments={attachments}
          onChange={setAttachments}
        />

        <div className="flex items-center justify-between border-t border-ink/8 pt-3">
          <p className="font-v4-mono text-[10.5px] text-ink/45">原話會寫入時間軸,AI 摘要另存</p>
          <button
            type="button"
            onClick={analyze}
            disabled={busy || !text.trim()}
            className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-paper transition hover:bg-graphite disabled:cursor-not-allowed disabled:bg-ink/30"
          >
            <Sparkles className="h-4 w-4" strokeWidth={1.75} />
            {busy ? '分析中…' : '分析'}
          </button>
        </div>
        {error && (
          <div className="rounded-md border border-claret/30 bg-claret/5 px-3.5 py-2.5 text-xs text-claret">{error}</div>
        )}
      </section>

      {result && <ParseResultPanel result={result} />}

      {!result && !busy && !error && (
        <div className="grid place-items-center gap-2 rounded-md border border-dashed border-ink/15 bg-paper/60 px-6 py-10 text-center">
          <Lightbulb className="h-5 w-5 text-ink/30" strokeWidth={1.5} />
          <div className="text-xs text-ink/55">輸入互動描述後按「分析」,AI 會建議 scores 變動 / 下一步 / 追問</div>
        </div>
      )}
    </div>
  );
}

function ParseResultPanel({ result }: { result: ParseResult }) {
  return (
    <section className="grid gap-3">
      <div className="label-caps text-ink/50">AI 解析結果</div>

      <article className="grid gap-1.5 rounded-md border border-ink/10 bg-paper p-4">
        <div className="label-caps text-forest/80">一句話總結</div>
        <p className="text-[14px] leading-6 text-ink">{result.summary}</p>
      </article>

      {result.score_updates.length > 0 && (
        <article className="grid gap-2 rounded-md border border-ink/10 bg-paper p-4">
          <div className="label-caps text-ink/55">建議分數變動 ({result.score_updates.length})</div>
          <ol className="grid gap-2">
            {result.score_updates.map((u, i) => {
              const delta = u.new - u.old;
              return (
                <li key={i} className="grid grid-cols-[1fr_auto] items-start gap-3 border-t border-ink/8 pt-2 first:border-t-0 first:pt-0">
                  <div className="grid gap-0.5">
                    <div className="text-sm font-semibold text-ink">{SCORE_LABEL[u.field] ?? u.field}</div>
                    <div className="text-xs text-ink/65">{u.reason}</div>
                  </div>
                  <div className="grid grid-cols-[auto_auto_auto] items-center gap-1.5 font-v4-mono text-xs">
                    <span className="numeric text-ink/45">{u.old}</span>
                    <ArrowUp className={cn('h-3 w-3', delta > 0 ? 'text-forest' : delta < 0 ? 'rotate-180 text-claret' : 'text-ink/30')} strokeWidth={2} />
                    <span className={cn('numeric font-semibold', delta > 0 ? 'text-forest' : delta < 0 ? 'text-claret' : 'text-ink')}>{u.new}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </article>
      )}

      {result.new_comment && (
        <article className="grid gap-1.5 rounded-md border border-ink/10 bg-paper p-4">
          <div className="label-caps text-ink/55">AI 摘要(將寫入時間軸)</div>
          <p className="text-sm leading-6 text-ink/85 whitespace-pre-wrap">{result.new_comment}</p>
        </article>
      )}

      {result.next_step_update && (
        <article className="grid gap-1.5 rounded-md border border-ink/10 bg-paper p-4">
          <div className="label-caps text-brass">建議下一步</div>
          <p className="text-sm leading-6 text-ink/85 whitespace-pre-wrap">{result.next_step_update}</p>
        </article>
      )}

      {result.stage_suggestion && (
        <article className="grid gap-1.5 rounded-md border border-ink/10 bg-paper p-4">
          <div className="label-caps text-cobalt">建議轉階段</div>
          <p className="text-sm text-ink/85">→ <span className="font-v4-mono font-semibold">{result.stage_suggestion}</span></p>
        </article>
      )}

      {result.ask_back.length > 0 && (
        <article className="grid gap-2 rounded-md border border-ink/10 bg-paper p-4">
          <div className="label-caps text-ink/55">下次該追問</div>
          <ul className="grid gap-1.5">
            {result.ask_back.map((q, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ink/80">
                <span className="mt-1 grid h-1 w-1 shrink-0 rounded-full bg-forest" />
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </article>
      )}
    </section>
  );
}
