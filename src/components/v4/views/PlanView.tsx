'use client';

// ============================================================
// 成交路徑規劃 view — 對選定客戶呼叫 /api/ai/generate-plan
// ============================================================
// 流程:
//   1. 左側列出 RLS 過濾後使用者能看到的客戶
//   2. 選一個客戶 → 右側顯示客戶 context + 目標成交日輸入
//   3. (可選)補充情境 → 按「生成成交路徑」 → POST /api/ai/generate-plan
//   4. 顯示真實 DealPlan:overview + feasibility + top_risks + steps[]
//
// 接的後端:既有 /api/ai/generate-plan(Claude Opus 4.7)
// 跟 ws_crm 既有 PlanModal 差異:全頁 view、v4 視覺;尚未做「存回 deals.plan」
// (這個之後可加,或讓 PlanModal 保留主流程)
// ============================================================
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ChevronRight, Sparkles, Target, Wand2, AlertTriangle, Calendar, ListChecks, MessageSquare, Save, Check, Loader2, ArrowUpRight } from 'lucide-react';
import type { Snapshot, Deal } from '@/lib/v4/types';
import { fmtMoney, cn } from '@/lib/v4/utils';
import { STAGES } from '@/lib/v4/constants';
import { savePlan } from '@/lib/v4/mutations';

interface PlanStep {
  id: string;
  title: string;
  target_date: string;
  stage_transition: string;
  focus: string[];
  talking_points: string[];
  risks: string[];
  completed?: boolean;
  completed_at?: string | null;
}
interface DealPlan {
  target_date: string;
  generated_at: string;
  model: string;
  overview: string;
  feasibility: 'high' | 'medium' | 'low';
  feasibility_reason: string;
  top_risks: string[];
  steps: PlanStep[];
}

const FEASIBILITY_STYLE: Record<DealPlan['feasibility'], { label: string; className: string }> = {
  high:   { label: '高', className: 'bg-forest/15 text-forest border-forest/30' },
  medium: { label: '中', className: 'bg-brass/15 text-brass border-brass/30' },
  low:    { label: '低', className: 'bg-claret/10 text-claret border-claret/30' },
};

export function PlanView({ snapshot, base = '/workspace' }: { snapshot: Snapshot; base?: string }) {
  const activeDeals = useMemo(
    () => snapshot.deals.filter((d) => d.stage !== 'L7').sort((a, b) => Number(b.aum_usd) - Number(a.aum_usd)),
    [snapshot.deals],
  );
  const [selectedId, setSelectedId] = useState<string | null>(activeDeals[0]?.id ?? null);
  const [targetDate, setTargetDate] = useState<string>(defaultTargetDate(activeDeals[0]));
  const [extraContext, setExtraContext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<DealPlan | null>(null);

  const selectedDeal = activeDeals.find((d) => d.id === selectedId) ?? null;
  const isFixtures = snapshot.source === 'fixtures';

  function selectDeal(id: string) {
    setSelectedId(id);
    const d = activeDeals.find((x) => x.id === id) ?? null;
    setTargetDate(defaultTargetDate(d));
    setExtraContext('');
    setPlan(null);
    setError(null);
  }

  async function generate() {
    if (!selectedDeal || busy) return;
    if (isFixtures) {
      setError('目前是 fixtures 模式(未接 Supabase),AI 生成路徑需要登入 + 真實案件');
      return;
    }
    if (!targetDate) { setError('請選擇目標成交日'); return; }
    setBusy(true); setError(null); setPlan(null);
    try {
      const res = await fetch('/api/ai/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId: selectedDeal.id,
          targetCloseDate: targetDate,
          extraContext: extraContext.trim() || undefined,
        }),
      });
      const raw = await res.text();
      let json: { data?: DealPlan; error?: string };
      try { json = JSON.parse(raw); } catch { throw new Error(`回應格式錯誤(HTTP ${res.status})`); }
      if (!res.ok) throw new Error(json.error || '生成失敗');
      if (!json.data) throw new Error('AI 沒有回傳資料');
      setPlan(json.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid min-h-[calc(100vh-1px)] max-w-[1240px] grid-cols-1 gap-6 px-6 pb-10 pt-12 lg:grid-cols-[380px_1fr] lg:px-10">
      {/* 左側:案件列表 */}
      <aside className="grid content-start gap-4">
        <header className="grid gap-1.5">
          <div className="label-caps text-ink/45">挑一個案件</div>
          <h2 className="font-v4-serif text-2xl font-medium leading-tight text-ink">活躍案件</h2>
          <p className="font-v4-mono text-xs text-ink/55 numeric">{activeDeals.length} 個 · 按 AUM 排序</p>
        </header>
        <ol className="grid gap-1.5">
          {activeDeals.map((d) => {
            const active = d.id === selectedId;
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => selectDeal(d.id)}
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
        </ol>
      </aside>

      {/* 右側:Plan UI */}
      <main className="grid content-start gap-6">
        <header className="grid gap-2">
          <div className="label-caps text-ink/45">成交路徑規劃</div>
          <h1 className="font-v4-serif text-[44px] font-medium leading-[0.95] tracking-tight text-ink lg:text-[56px]">
            {selectedDeal ? <>從 <span className="italic text-forest">{selectedDeal.stage}</span> 到成交</> : '選一個案件開始'}
          </h1>
          {selectedDeal && (
            <p className="mt-1 text-sm leading-6 text-ink/65 max-w-2xl">
              {selectedDeal.name} · {fmtMoney(Number(selectedDeal.aum_usd))} · {STAGES.find((s) => s.id === selectedDeal.stage)?.name}
              {selectedDeal.next_step ? <><br /><span className="font-v4-mono text-[11px] text-ink/50">當前下一步:{selectedDeal.next_step}</span></> : null}
            </p>
          )}
        </header>

        {selectedDeal && (
          <section className="grid gap-3 rounded-md border border-ink/10 bg-paper p-5">
            <div className="grid gap-3 sm:grid-cols-[200px_1fr] sm:items-end">
              <label className="grid gap-1.5">
                <span className="label-caps text-ink/55 inline-flex items-center gap-1.5"><Calendar className="h-3 w-3" strokeWidth={2} /> 目標成交日</span>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  min={todayStr()}
                  className="rounded-md border border-ink/12 bg-cream/40 px-3 py-2 font-v4-mono text-sm text-ink focus:border-ink/30 focus:outline-none"
                  disabled={busy}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="label-caps text-ink/55">補充情境(可選)</span>
                <input
                  type="text"
                  value={extraContext}
                  onChange={(e) => setExtraContext(e.target.value)}
                  placeholder="例如:客戶下週出國一週、配偶剛同意、銀行抽銀根…"
                  className="rounded-md border border-ink/12 bg-cream/40 px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:border-ink/30 focus:outline-none"
                  disabled={busy}
                />
              </label>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-v4-mono text-[10.5px] text-ink/45">後端走 Claude Opus 4.7,通常 30~60 秒</span>
              <button
                type="button"
                onClick={generate}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-paper transition hover:bg-graphite disabled:cursor-not-allowed disabled:bg-ink/30"
              >
                <Wand2 className="h-4 w-4" strokeWidth={1.75} />
                {busy ? '生成中…' : plan ? '重新生成' : '生成成交路徑'}
              </button>
            </div>
            {error && (
              <div className="rounded-md border border-claret/30 bg-claret/5 px-3.5 py-2.5 text-xs text-claret">{error}</div>
            )}
          </section>
        )}

        {plan && selectedDeal && (
          <PlanResult
            plan={plan}
            dealId={selectedDeal.id}
            dealName={selectedDeal.name}
            isFixtures={isFixtures}
            viewDealHref={`${base}/clients/${selectedDeal.id}`}
          />
        )}

        {!plan && !busy && !error && selectedDeal && (
          <div className="grid place-items-center gap-2 rounded-md border border-dashed border-ink/15 bg-paper/60 px-6 py-12 text-center">
            <Target className="h-6 w-6 text-ink/30" strokeWidth={1.5} />
            <div className="text-sm text-ink/55">填好目標日 + 補充情境後按「生成成交路徑」</div>
          </div>
        )}
      </main>
    </div>
  );
}

// ============================================================
// 結果面板
// ============================================================
function PlanResult({
  plan, dealId, dealName, isFixtures, viewDealHref,
}: {
  plan: DealPlan;
  dealId: string;
  dealName: string;
  isFixtures: boolean;
  viewDealHref: string;
}) {
  const feas = FEASIBILITY_STYLE[plan.feasibility];
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  function handleSave() {
    if (saving || isFixtures) {
      if (isFixtures) { setSaveErr('fixtures 模式無法儲存'); return; }
      return;
    }
    setSaving(true); setSaveErr(null);
    savePlan(dealId, plan)
      .then(() => {
        // saved 維持 true,讓「→ 客戶頁面」連結持續顯示;
        // 不自動 reset 才不會 2.5 秒後就消失
        setSaved(true);
      })
      .catch((err) => setSaveErr((err as Error).message))
      .finally(() => setSaving(false));
  }

  return (
    <section className="grid gap-4">
      <div className="label-caps text-ink/50 inline-flex items-center gap-2">
        <Sparkles className="h-3 w-3 text-cobalt" strokeWidth={2} />
        AI 規劃成果 · {plan.model}
      </div>

      {/* Overview + feasibility */}
      <article className="grid gap-3 rounded-md border border-ink/10 bg-paper p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1.5">
            <div className="label-caps text-ink/55">總覽</div>
            <p className="text-[15px] leading-7 text-ink whitespace-pre-wrap">{plan.overview}</p>
          </div>
          <div className={cn('shrink-0 rounded-md border px-3 py-2 text-center', feas.className)}>
            <div className="font-v4-mono text-[9px] uppercase tracking-widest">可行性</div>
            <div className="font-v4-serif text-3xl font-semibold leading-none">{feas.label}</div>
          </div>
        </div>
        <div className="border-t border-ink/8 pt-3 text-sm leading-6 text-ink/70">{plan.feasibility_reason}</div>
      </article>

      {/* Top risks */}
      {plan.top_risks.length > 0 && (
        <article className="grid gap-2 rounded-md border border-ink/10 bg-paper p-5">
          <div className="label-caps text-claret inline-flex items-center gap-1.5"><AlertTriangle className="h-3 w-3" strokeWidth={2} /> 三大風險</div>
          <ul className="grid gap-1.5">
            {plan.top_risks.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ink/85">
                <span className="mt-1.5 grid h-1.5 w-1.5 shrink-0 rounded-full bg-claret/70" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </article>
      )}

      {/* Steps */}
      {plan.steps.length > 0 && (
        <article className="grid gap-3">
          <div className="label-caps text-ink/55">建議步驟 ({plan.steps.length})</div>
          <ol className="grid gap-2">
            {plan.steps.map((step, idx) => (
              <li key={step.id ?? idx} className="grid grid-cols-[auto_1fr] items-start gap-4 rounded-md border border-ink/10 bg-paper p-5">
                <div className="grid h-9 w-9 place-items-center rounded-md bg-forest/10 font-v4-serif text-lg font-semibold text-forest numeric">{idx + 1}</div>
                <div className="grid gap-2">
                  <div className="grid grid-cols-[1fr_auto] items-baseline gap-3">
                    <div className="text-base font-semibold text-ink">{step.title}</div>
                    <span className="rounded-sm px-2 py-1 text-[10px] font-v4-mono font-semibold uppercase tracking-widest stage-L4">{step.stage_transition}</span>
                  </div>
                  <div className="font-v4-mono text-[11px] text-ink/55 numeric"><Calendar className="inline h-3 w-3 mb-0.5 mr-1" strokeWidth={2} />{step.target_date}</div>
                  {step.focus.length > 0 && (
                    <div className="grid gap-1">
                      <div className="label-caps text-ink/50 inline-flex items-center gap-1.5"><ListChecks className="h-3 w-3" strokeWidth={2} /> 核心動作</div>
                      <ul className="grid gap-1">
                        {step.focus.map((f, i) => <li key={i} className="flex items-start gap-2 text-sm text-ink/85"><span className="mt-1.5 grid h-1 w-1 shrink-0 rounded-full bg-forest" /><span>{f}</span></li>)}
                      </ul>
                    </div>
                  )}
                  {step.talking_points.length > 0 && (
                    <div className="grid gap-1">
                      <div className="label-caps text-ink/50 inline-flex items-center gap-1.5"><MessageSquare className="h-3 w-3" strokeWidth={2} /> 建議話術</div>
                      <ul className="grid gap-1">
                        {step.talking_points.map((t, i) => <li key={i} className="text-sm leading-6 text-ink/75">「{t}」</li>)}
                      </ul>
                    </div>
                  )}
                  {step.risks.length > 0 && (
                    <div className="grid gap-1">
                      <div className="label-caps text-claret/80 inline-flex items-center gap-1.5"><AlertTriangle className="h-3 w-3" strokeWidth={2} /> 風險</div>
                      <ul className="grid gap-1">
                        {step.risks.map((r, i) => <li key={i} className="flex items-start gap-2 text-sm text-ink/75"><span className="mt-1.5 grid h-1 w-1 shrink-0 rounded-full bg-claret/60" /><span>{r}</span></li>)}
                      </ul>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </article>
      )}

      {/* 儲存按鈕 — sticky 在頁面底部 */}
      <div className="sticky bottom-4 mt-2 grid gap-2 rounded-md border border-ink/15 bg-paper p-4 shadow-panel">
        {saveErr && (
          <div className="rounded-md border border-claret/30 bg-claret/5 px-3 py-2 text-xs text-claret">{saveErr}</div>
        )}
        {saved && (
          <Link
            href={viewDealHref as never}
            className="group flex items-center justify-between gap-3 rounded-md border border-forest/30 bg-forest/5 px-3.5 py-2.5 text-forest transition hover:bg-forest/10"
          >
            <span className="grid gap-0.5">
              <span className="label-caps text-forest/75">已儲存到 deals.plan</span>
              <span className="text-sm font-semibold">到「{dealName}」客戶頁面看完整規劃 + 勾選步驟</span>
            </span>
            <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={1.75} />
          </Link>
        )}
        <div className="flex items-center justify-between gap-3">
          <div className="grid gap-0.5">
            <span className="font-v4-mono text-[11px] text-ink/65">
              儲存到 deals.plan,客戶詳情頁就看得到 + 可勾選步驟完成
            </span>
            <span className="font-v4-mono text-[10.5px] text-ink/45">
              同時把目標成交日設為 {plan.target_date},時間軸寫一筆系統 comment
            </span>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || saved || isFixtures}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-paper transition shrink-0',
              saved ? 'bg-forest' : 'bg-ink hover:bg-graphite',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
              : saved ? <Check className="h-4 w-4" strokeWidth={2.5} />
              : <Save className="h-4 w-4" strokeWidth={2} />}
            {saving ? '儲存中…' : saved ? '✓ 已儲存到本案件' : '儲存這份規劃'}
          </button>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// 純函式
// ============================================================
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultTargetDate(deal: Deal | undefined | null): string {
  if (deal?.target_close_date) return deal.target_close_date;
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}
