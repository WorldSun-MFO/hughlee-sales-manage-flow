'use client';

// ============================================================
// 已儲存 plan 的 inline 顯示 — 對應 ws_crm DealDetail.tsx 276–333 行
// ============================================================
// 跟 DealPlanPanel(Drawer 內生成 + 立刻顯示結果)的差異:
//   - 這支只負責「展示已寫進 deals.plan 的內容」,不負責生成。
//   - 每個 step 有 checkbox,勾掉走 togglePlanStep(dealId, stepId)
//     會把 step.completed 翻轉並寫回整顆 plan JSONB。
// ============================================================
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Target, Check, MessageSquare, AlertTriangle, ListChecks, Calendar, Loader2,
} from 'lucide-react';
import type { DealPlan, DealPlanStep } from '@/lib/v4/types';
import { cn } from '@/lib/v4/utils';
import { togglePlanStep } from '@/lib/v4/mutations';

const FEAS_STYLE: Record<DealPlan['feasibility'], { label: string; className: string }> = {
  high:   { label: '可行性高', className: 'border-forest/30 bg-forest/12 text-forest' },
  medium: { label: '可行性中', className: 'border-brass/30 bg-brass/15 text-brass' },
  low:    { label: '可行性低', className: 'border-claret/30 bg-claret/10 text-claret' },
};

export function SavedPlanClient({
  dealId, plan, isFixtures,
}: {
  dealId: string;
  plan: DealPlan;
  isFixtures: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = () => undefined; // fire-and-forget;不再 router.refresh,改靠本地 optimistic state

  const completedCount = plan.steps.filter((s) => s.completed).length;
  const total = plan.steps.length;
  const feas = FEAS_STYLE[plan.feasibility];

  return (
    <section className="grid gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="label-caps text-ink/55 inline-flex items-center gap-1.5">
          <Target className="h-3 w-3 text-cobalt" strokeWidth={2} />
          成交路徑
        </div>
        <div className="font-v4-mono text-[10.5px] text-ink/45 numeric">
          AI 產於 {plan.generated_at.slice(0, 10)}
        </div>
      </div>

      <article className="grid gap-3 rounded-md border border-cobalt/25 bg-cobalt/5 p-4">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="grid gap-1">
            <div className="flex items-baseline gap-2">
              <span className="font-v4-serif text-base font-semibold text-ink">目標成交日</span>
              <span className="font-v4-mono text-sm text-ink/85 numeric">{plan.target_date}</span>
            </div>
            <div className="font-v4-mono text-[11px] text-ink/55 numeric">
              已完成 {completedCount} / {total} 步
            </div>
          </div>
          <span className={cn(
            'shrink-0 rounded-md border px-2 py-0.5 font-v4-mono text-[10px] font-semibold uppercase tracking-widest',
            feas.className,
          )}>
            {feas.label}
          </span>
        </header>

        <ol className="grid gap-1.5">
          {plan.steps.map((step, idx) => (
            <PlanStepRow
              key={step.id}
              dealId={dealId}
              step={step}
              index={idx}
              isFixtures={isFixtures}
              onChanged={refresh}
            />
          ))}
        </ol>
      </article>
    </section>
  );
}

function PlanStepRow({
  dealId, step, index, isFixtures, onChanged,
}: {
  dealId: string;
  step: DealPlanStep;
  index: number;
  isFixtures: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const completed = !!step.completed;
  const hasDetails = step.focus.length > 0 || step.talking_points.length > 0 || step.risks.length > 0;

  async function toggle() {
    if (busy) return;
    if (isFixtures) { setErr('fixtures 模式無法寫入'); return; }
    setBusy(true); setErr(null);
    try { await togglePlanStep(dealId, step.id); onChanged(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <li className="grid gap-1 rounded-md border border-ink/8 bg-paper p-3">
      <div className="grid grid-cols-[auto_1fr] items-start gap-2.5">
        <button
          type="button"
          onClick={toggle}
          disabled={busy || isFixtures}
          aria-pressed={completed}
          className={cn(
            'mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-sm border transition',
            completed ? 'border-forest bg-forest text-paper' : 'border-ink/30 bg-paper hover:border-ink/50',
            'disabled:cursor-not-allowed disabled:opacity-60',
          )}
        >
          {busy
            ? <Loader2 className="h-2.5 w-2.5 animate-spin" strokeWidth={2.5} />
            : completed && <Check className="h-3 w-3" strokeWidth={3} />}
        </button>
        <div className="grid gap-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-v4-mono text-[11px] text-ink/45 numeric">{index + 1}.</span>
            <span className={cn(
              'text-sm leading-6',
              completed ? 'text-ink/45 line-through' : 'font-semibold text-ink',
            )}>
              {step.title}
            </span>
            <span className="font-v4-mono text-[10.5px] text-ink/55 numeric inline-flex items-center gap-1">
              <Calendar className="h-2.5 w-2.5" strokeWidth={2} />
              {step.target_date}
            </span>
            <span className="rounded-sm bg-ink/8 px-1.5 py-0.5 font-v4-mono text-[9.5px] font-semibold uppercase tracking-widest text-ink/65">
              {step.stage_transition}
            </span>
          </div>
          {!completed && hasDetails && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="justify-self-start font-v4-mono text-[10.5px] font-semibold text-cobalt hover:text-cobalt/80"
            >
              {expanded ? '收起動作與話術' : '查看動作與話術'}
            </button>
          )}
          {!completed && expanded && hasDetails && (
            <div className="mt-1 grid gap-2 border-t border-ink/8 pt-2">
              {step.focus.length > 0 && (
                <div className="grid gap-1">
                  <div className="label-caps text-ink/55 inline-flex items-center gap-1.5">
                    <ListChecks className="h-2.5 w-2.5" strokeWidth={2} /> 動作
                  </div>
                  <ul className="grid gap-0.5">
                    {step.focus.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs leading-5 text-ink/80">
                        <span className="mt-1.5 grid h-1 w-1 shrink-0 rounded-full bg-ink/35" />
                        <span className="whitespace-pre-wrap">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {step.talking_points.length > 0 && (
                <div className="grid gap-1">
                  <div className="label-caps text-ink/55 inline-flex items-center gap-1.5">
                    <MessageSquare className="h-2.5 w-2.5" strokeWidth={2} /> 話術
                  </div>
                  <ul className="grid gap-0.5">
                    {step.talking_points.map((t, i) => (
                      <li key={i} className="text-xs leading-5 text-ink/75">「{t}」</li>
                    ))}
                  </ul>
                </div>
              )}
              {step.risks.length > 0 && (
                <div className="grid gap-1">
                  <div className="label-caps text-claret/80 inline-flex items-center gap-1.5">
                    <AlertTriangle className="h-2.5 w-2.5" strokeWidth={2} /> 風險
                  </div>
                  <ul className="grid gap-0.5">
                    {step.risks.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs leading-5 text-claret/90">
                        <span className="mt-1.5 grid h-1 w-1 shrink-0 rounded-full bg-claret/60" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {err && <div className="font-v4-mono text-[10.5px] text-claret">{err}</div>}
        </div>
      </div>
    </li>
  );
}
