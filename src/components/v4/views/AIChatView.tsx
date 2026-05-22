'use client';

// ============================================================
// AI 助手 view — 對選定客戶執行 parse-interaction
// ============================================================
// 流程:
//   1. 左側列出 RLS 過濾後使用者能看到的客戶
//   2. 選一個客戶 → 右側顯示客戶 context + 互動文字輸入框
//   3. 描述「這次跟客戶聊了什麼」→ 按「分析」 → POST /api/ai/parse-interaction
//   4. 顯示 AI 解析結果:summary、scores 變動、新 comment、next_step、stage 建議、追問清單
//
// 跟 ws_crm 既有 AIChatModal 的差異:
//   - 不是 modal 而是全頁 view(workspace nav / hub 卡 點進來)
//   - 用 v4 paper/forest 視覺
//   - Phase 2.1 只做「看結果」,Apply 流程(打回 DB)留到 Phase 2.3
// ============================================================
import { useState, useMemo } from 'react';
import { ArrowUp, ChevronRight, Sparkles, Lightbulb } from 'lucide-react';
import type { Snapshot, Deal, StageId } from '@/lib/v4/types';
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
  m: 'M — Metrics',
  e: 'E — Economic Buyer',
  d1: 'D₁ — Decision Criteria',
  d2: 'D₂ — Decision Process',
  p: 'P — Paper Process',
  i: 'I — Identify Pain',
  c1: 'C₁ — Champion',
  c2: 'C₂ — Competition',
};

export function AIChatView({ snapshot, base: _base = '/v4/workspace' }: { snapshot: Snapshot; base?: string }) {
  const activeDeals = useMemo(
    () => snapshot.deals.filter((d) => d.stage !== 'L7').sort((a, b) => Number(b.aum_usd) - Number(a.aum_usd)),
    [snapshot.deals],
  );
  const [selectedId, setSelectedId] = useState<string | null>(activeDeals[0]?.id ?? null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);

  const selectedDeal = activeDeals.find((d) => d.id === selectedId) ?? null;
  const isFixtures = snapshot.source === 'fixtures';

  async function analyze() {
    if (!selectedDeal || !text.trim() || busy) return;
    if (isFixtures) {
      setError('目前是 fixtures 模式(未接 Supabase),AI 分析需要登入 + 真實案件');
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/ai/parse-interaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: selectedDeal.id, userText: text.trim() }),
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

  return (
    <div className="mx-auto grid min-h-[calc(100vh-1px)] max-w-[1240px] grid-cols-1 gap-6 px-6 pb-10 pt-12 lg:grid-cols-[320px_1fr] lg:px-10">
      <DealList deals={activeDeals} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setResult(null); setError(null); setText(''); setAttachments([]); }} />

      <main className="grid content-start gap-6">
        <header className="grid gap-2">
          <div className="label-caps text-ink/45">AI 助手 · 客戶互動解析</div>
          <h1 className="font-v4-serif text-[44px] font-medium leading-[0.95] tracking-tight text-ink lg:text-[56px]">
            {selectedDeal ? <>跟 <span className="italic text-forest">{selectedDeal.name.split(' — ')[0] ?? selectedDeal.name}</span> 聊了什麼?</> : '選一個客戶開始'}
          </h1>
          {selectedDeal && <DealContextLine deal={selectedDeal} />}
        </header>

        {selectedDeal && (
          <>
            <section className="grid gap-3 rounded-md border border-ink/10 bg-paper p-5">
              <label className="grid gap-2">
                <span className="label-caps text-ink/55">這次的互動描述</span>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={6}
                  placeholder="例如:今天下午打電話給陳先生,他說他考慮加碼到 300 萬美金,但太太還沒點頭。下週三要一起吃晚餐讓我見太太。他擔心銀行抽銀根..."
                  className="w-full resize-vertical rounded-md border border-ink/12 bg-cream/40 px-3.5 py-3 text-sm leading-6 text-ink placeholder:text-ink/40 focus:border-ink/30 focus:outline-none"
                  disabled={busy}
                />
              </label>

              <AttachmentTray
                dealId={selectedDeal.id}
                isFixtures={isFixtures}
                attachments={attachments}
                onChange={setAttachments}
              />

              <div className="flex items-center justify-between border-t border-ink/8 pt-3">
                <p className="font-v4-mono text-[10.5px] text-ink/45">
                  原話會寫入時間軸(is_raw),AI 摘要另存。Phase 2.3 再做 Apply 流程。
                </p>
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
              <div className="grid place-items-center gap-2 rounded-md border border-dashed border-ink/15 bg-paper/60 px-6 py-12 text-center">
                <Lightbulb className="h-6 w-6 text-ink/30" strokeWidth={1.5} />
                <div className="text-sm text-ink/55">輸入互動描述後按「分析」,AI 會建議 scores 變動 / 下一步 / 追問</div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ============================================================
// 子元件
// ============================================================
function DealList({ deals, selectedId, onSelect }: { deals: Deal[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <aside className="grid content-start gap-4">
      <header className="grid gap-1.5">
        <div className="label-caps text-ink/45">你的客戶</div>
        <h2 className="font-v4-serif text-2xl font-medium leading-tight text-ink">活躍案件</h2>
        <p className="font-v4-mono text-xs text-ink/55 numeric">{deals.length} 個 · 按 AUM 排序</p>
      </header>
      <ol className="grid gap-1.5">
        {deals.map((d) => {
          const active = d.id === selectedId;
          return (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => onSelect(d.id)}
                className={cn(
                  'grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-md border px-3.5 py-2.5 text-left transition',
                  active ? 'border-ink/40 bg-paper shadow-chip' : 'border-ink/8 bg-paper/60 hover:border-ink/20 hover:bg-paper',
                )}
              >
                <div className="grid gap-0.5">
                  <div className="truncate text-sm font-semibold text-ink">{d.name}</div>
                  <div className="font-v4-mono text-[10px] text-ink/55 numeric">{d.stage} · {fmtMoney(Number(d.aum_usd))} · {d.tier ?? '—'}</div>
                </div>
                <ChevronRight className={cn('h-4 w-4 shrink-0 transition', active ? 'text-ink' : 'text-ink/30')} strokeWidth={1.75} />
              </button>
            </li>
          );
        })}
        {deals.length === 0 && (
          <li className="rounded-md border border-dashed border-ink/15 px-3.5 py-6 text-center text-xs text-ink/45">
            沒有可分析的客戶(L7 已成交不在此清單)
          </li>
        )}
      </ol>
    </aside>
  );
}

function DealContextLine({ deal }: { deal: Deal }) {
  const stageName = STAGES.find((s) => s.id === deal.stage)?.name;
  return (
    <p className="mt-1 text-sm leading-6 text-ink/65 max-w-2xl">
      {fmtMoney(Number(deal.aum_usd))} · {deal.stage}{stageName ? ` · ${stageName}` : ''} · Tier {deal.tier ?? '—'}
      {deal.next_step ? <><br /><span className="font-v4-mono text-[11px] text-ink/50">當前下一步:{deal.next_step}</span></> : null}
    </p>
  );
}

function ParseResultPanel({ result }: { result: ParseResult }) {
  return (
    <section className="grid gap-4">
      <div className="label-caps text-ink/50">AI 解析結果</div>

      {/* Summary */}
      <article className="grid gap-1.5 rounded-md border border-ink/10 bg-paper p-5">
        <div className="label-caps text-forest/80">一句話總結</div>
        <p className="text-[15px] leading-7 text-ink">{result.summary}</p>
      </article>

      {/* Score updates */}
      {result.score_updates.length > 0 && (
        <article className="grid gap-3 rounded-md border border-ink/10 bg-paper p-5">
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

      {/* New comment */}
      {result.new_comment && (
        <article className="grid gap-1.5 rounded-md border border-ink/10 bg-paper p-5">
          <div className="label-caps text-ink/55">AI 摘要(將寫入時間軸)</div>
          <p className="text-sm leading-6 text-ink/85 whitespace-pre-wrap">{result.new_comment}</p>
        </article>
      )}

      {/* Next step */}
      {result.next_step_update && (
        <article className="grid gap-1.5 rounded-md border border-ink/10 bg-paper p-5">
          <div className="label-caps text-brass">建議下一步</div>
          <p className="text-sm leading-6 text-ink/85 whitespace-pre-wrap">{result.next_step_update}</p>
        </article>
      )}

      {/* Stage suggestion */}
      {result.stage_suggestion && (
        <article className="grid gap-1.5 rounded-md border border-ink/10 bg-paper p-5">
          <div className="label-caps text-cobalt">建議轉階段</div>
          <p className="text-sm text-ink/85">→ <span className="font-v4-mono font-semibold">{result.stage_suggestion}</span> ({STAGES.find((s) => s.id === result.stage_suggestion)?.name})</p>
        </article>
      )}

      {/* Ask back */}
      {result.ask_back.length > 0 && (
        <article className="grid gap-2 rounded-md border border-ink/10 bg-paper p-5">
          <div className="label-caps text-ink/55">下次該追問的問題</div>
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

      <footer className="font-v4-mono text-[10.5px] text-ink/45">
        Phase 2.3 之後會加「逐項打勾後套用回 deal」的 UI(對應既有 AIChatModal.applySelected)。
      </footer>
    </section>
  );
}
