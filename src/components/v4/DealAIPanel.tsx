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
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowUp, Lightbulb, Check, Loader2, ArrowUpRight } from 'lucide-react';
import type { Deal, Scores, StageId } from '@/lib/v4/types';
import { fmtMoney, cn } from '@/lib/v4/utils';
import { STAGES } from '@/lib/v4/constants';
import { AttachmentTray } from '@/components/v4/AttachmentTray';
import { AutoTextarea } from '@/components/v4/AutoTextarea';
import type { UploadedAttachment } from '@/lib/v4/upload';
import { patchDeal, patchScores, addComment } from '@/lib/v4/mutations';

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

export function DealAIPanel({
  deal,
  isFixtures,
  viewDealHref,
}: {
  deal: Deal;
  isFixtures: boolean;
  /** 若提供,Apply 成功後會顯示「→ 查看 {客戶}」連結。Drawer 內部使用時不傳(已在該客戶頁) */
  viewDealHref?: string;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  // 快照「按分析當下」的原話:之後就算又改了輸入框,套用時存進活動紀錄的仍是被分析的那段
  const [analyzedText, setAnalyzedText] = useState('');

  async function analyze() {
    if (!text.trim() || busy) return;
    if (isFixtures) { setError('目前是 fixtures 模式(未接 Supabase),AI 分析需要登入 + 真實案件'); return; }
    const submitted = text.trim();
    setBusy(true); setError(null); setResult(null);
    setAnalyzedText(submitted);
    try {
      const res = await fetch('/api/ai/parse-interaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id, userText: submitted }),
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
          <AutoTextarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="例如:今天下午打電話給陳先生,他說他考慮加碼到 300 萬美金,但太太還沒點頭。下週三要一起吃晚餐讓我見太太。他擔心銀行抽銀根,問我宏利財摯宏耀有沒有 Margin Call 條款..."
            className="min-h-[9.5rem] w-full rounded-md border border-ink/12 bg-cream/40 px-3.5 py-3 text-sm leading-6 text-ink placeholder:text-ink/40 focus:border-ink/30 focus:outline-none"
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

      {result && (
        <ParseResultPanel
          result={result}
          userText={analyzedText}
          dealId={deal.id}
          dealName={deal.name}
          isFixtures={isFixtures}
          viewDealHref={viewDealHref}
          onApplied={() => { setResult(null); setText(''); }}
        />
      )}

      {!result && !busy && !error && (
        <div className="grid place-items-center gap-2 rounded-md border border-dashed border-ink/15 bg-paper/60 px-6 py-10 text-center">
          <Lightbulb className="h-5 w-5 text-ink/30" strokeWidth={1.5} />
          <div className="text-xs text-ink/55">輸入互動描述後按「分析」,AI 會建議 scores 變動 / 下一步 / 追問</div>
        </div>
      )}
    </div>
  );
}

function ParseResultPanel({
  result, userText, dealId, dealName, isFixtures, viewDealHref, onApplied,
}: {
  result: ParseResult;
  userText: string;
  dealId: string;
  dealName: string;
  isFixtures: boolean;
  viewDealHref?: string;
  onApplied: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const hasRaw = userText.trim().length > 0;
  // 預設全部勾選(讓 RM 一鍵 apply,不想要的再個別取消)
  const [pickRaw, setPickRaw] = useState(true);
  const [pickScores, setPickScores] = useState<boolean[]>(() => result.score_updates.map(() => true));
  const [pickComment, setPickComment] = useState(!!result.new_comment);
  const [pickNextStep, setPickNextStep] = useState(result.next_step_update !== null);
  const [pickStage, setPickStage] = useState(!!result.stage_suggestion);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // AI 摘要 / 建議下一步 改為可編輯:初始帶 AI 產出的文字,套用時用編輯後的值
  const [comment, setComment] = useState(result.new_comment);
  const [nextStep, setNextStep] = useState(result.next_step_update ?? '');

  const totalPicks = (hasRaw && pickRaw ? 1 : 0) + pickScores.filter(Boolean).length + (pickComment ? 1 : 0) + (pickNextStep ? 1 : 0) + (pickStage ? 1 : 0);

  async function applyAll() {
    if (busy || isFixtures) {
      if (isFixtures) setError('fixtures 模式無法套用');
      return;
    }
    setBusy(true); setError(null);
    try {
      // scores
      const scoresPatch: Partial<Scores> = {};
      result.score_updates.forEach((u, i) => {
        if (pickScores[i]) (scoresPatch as Record<string, number>)[u.field] = u.new;
      });
      if (Object.keys(scoresPatch).length > 0) await patchScores(dealId, scoresPatch);

      // deal 欄位(下一步用編輯後的文字;清空則略過,不覆寫成空)
      const dealPatch: { next_step?: string | null; stage?: StageId } = {};
      if (pickNextStep && nextStep.trim()) dealPatch.next_step = nextStep.trim();
      if (pickStage && result.stage_suggestion) dealPatch.stage = result.stage_suggestion;
      if (Object.keys(dealPatch).length > 0) await patchDeal(dealId, dealPatch);

      // 活動紀錄:以 AI 摘要為主,原話一併存進同一筆的 raw_body
      // (活動紀錄可 hover 預覽 / 點開看全文)
      const summaryText = comment.trim();
      const rawText = pickRaw && userText.trim() ? userText.trim() : null;
      if (pickComment && summaryText) {
        await addComment(dealId, summaryText, { rawBody: rawText });
      } else if (rawText) {
        // 只勾原話、沒摘要 → 單獨存一筆原話
        await addComment(dealId, rawText, { isRaw: true });
      }

      setDone(true);
      // 寫回後刷新 server components,讓「下一步」/ 活動紀錄 / 分數 立刻反映,不必手動重整
      startTransition(() => router.refresh());
      // 有 viewDealHref(sidebar 用)時,保留結果讓使用者看連結;
      // Drawer 用(沒 href)1.5 秒後自動收掉。
      if (!viewDealHref) {
        setTimeout(() => { setDone(false); onApplied(); }, 1500);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-3">
      <div className="flex items-baseline justify-between">
        <div className="label-caps text-ink/50">AI 解析結果</div>
        <div className="font-v4-mono text-[10.5px] text-ink/45">勾選要套用的項目 ↓</div>
      </div>

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
              const picked = pickScores[i];
              return (
                <li key={i} className={cn('grid grid-cols-[auto_1fr_auto] items-start gap-3 border-t border-ink/8 pt-2 first:border-t-0 first:pt-0 transition', !picked && 'opacity-40')}>
                  <PickBox checked={picked} onChange={(v) => setPickScores((p) => p.map((x, j) => j === i ? v : x))} />
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

      {hasRaw && (
        <article className={cn('grid grid-cols-[auto_1fr] items-start gap-3 rounded-md border border-ink/10 bg-paper p-4 transition', !pickRaw && 'opacity-40')}>
          <PickBox checked={pickRaw} onChange={setPickRaw} />
          <div className="grid gap-1.5">
            <div className="label-caps text-cobalt">原話(活動紀錄可預覽 / 點開)</div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-ink/70">{userText}</p>
          </div>
        </article>
      )}

      {result.new_comment && (
        <article className={cn('grid grid-cols-[auto_1fr] items-start gap-3 rounded-md border border-ink/10 bg-paper p-4 transition', !pickComment && 'opacity-40')}>
          <PickBox checked={pickComment} onChange={setPickComment} />
          <div className="grid gap-1.5">
            <div className="label-caps text-ink/55">AI 摘要(將寫入時間軸)</div>
            <AutoTextarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[3.5rem] w-full rounded-md border border-ink/12 bg-cream/40 px-3 py-2 text-sm leading-6 text-ink/85 focus:border-ink/30 focus:outline-none"
            />
          </div>
        </article>
      )}

      {result.next_step_update && (
        <article className={cn('grid grid-cols-[auto_1fr] items-start gap-3 rounded-md border border-ink/10 bg-paper p-4 transition', !pickNextStep && 'opacity-40')}>
          <PickBox checked={pickNextStep} onChange={setPickNextStep} />
          <div className="grid gap-1.5">
            <div className="label-caps text-brass">建議下一步</div>
            <AutoTextarea
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              className="min-h-[2.75rem] w-full rounded-md border border-ink/12 bg-cream/40 px-3 py-2 text-sm leading-6 text-ink/85 focus:border-ink/30 focus:outline-none"
            />
          </div>
        </article>
      )}

      {result.stage_suggestion && (
        <article className={cn('grid grid-cols-[auto_1fr] items-start gap-3 rounded-md border border-ink/10 bg-paper p-4 transition', !pickStage && 'opacity-40')}>
          <PickBox checked={pickStage} onChange={setPickStage} />
          <div className="grid gap-1.5">
            <div className="label-caps text-cobalt">建議轉階段</div>
            <p className="text-sm text-ink/85">→ <span className="font-v4-mono font-semibold">{result.stage_suggestion}</span></p>
          </div>
        </article>
      )}

      {result.ask_back.length > 0 && (
        <article className="grid gap-2 rounded-md border border-ink/10 bg-paper p-4">
          <div className="label-caps text-ink/55">下次該追問(僅參考,不會寫入)</div>
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

      {/* Apply 操作列 */}
      <div className="sticky bottom-0 -mx-6 grid gap-2 border-t border-ink/10 bg-paper/95 px-6 py-3 backdrop-blur">
        {error && <div className="rounded-md border border-claret/30 bg-claret/5 px-3 py-2 text-xs text-claret">{error}</div>}
        {done && viewDealHref && (
          <Link
            href={viewDealHref as never}
            className="group flex items-center justify-between gap-3 rounded-md border border-forest/30 bg-forest/5 px-3.5 py-2.5 text-forest transition hover:bg-forest/10"
          >
            <span className="grid gap-0.5">
              <span className="label-caps text-forest/75">已儲存</span>
              <span className="text-sm font-semibold">到「{dealName}」客戶頁面</span>
            </span>
            <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={1.75} />
          </Link>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="font-v4-mono text-[10.5px] text-ink/55">勾 {totalPicks} 項將寫回 deal · 紅旗 / 排序會立刻刷新</span>
          <button
            type="button"
            onClick={applyAll}
            disabled={busy || done || totalPicks === 0}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-paper transition',
              done ? 'bg-forest' : 'bg-ink hover:bg-graphite',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : done ? <Check className="h-4 w-4" strokeWidth={2} /> : <ArrowUp className="h-4 w-4 rotate-45" strokeWidth={1.75} />}
            {busy ? '套用中…' : done ? '已套用' : `套用 ${totalPicks} 項`}
          </button>
        </div>
      </div>
    </section>
  );
}

function PickBox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-sm border transition',
        checked ? 'border-ink bg-ink text-paper' : 'border-ink/30 bg-paper hover:border-ink/50',
      )}
      aria-pressed={checked}
    >
      {checked && <Check className="h-3 w-3" strokeWidth={3} />}
    </button>
  );
}
