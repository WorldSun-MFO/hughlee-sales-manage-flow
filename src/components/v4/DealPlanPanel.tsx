'use client';

// ============================================================
// 單一客戶的成交規劃面板 — 給 ClientDetailView 的 Drawer 用
// ============================================================
// 跟 PlanView 的差異:
//   - PlanView:左側案件列表 + 右側操作。整頁。
//   - 這支:沒有案件列表(已知 deal),只剩日期輸入 + 補充情境 + 生成 + 結果。
//
// 接的後端跟 PlanView 完全一樣:POST /api/ai/generate-plan
// ============================================================
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Wand2, Target, Sparkles, AlertTriangle, ListChecks, MessageSquare, Save, Check, Loader2, ListTodo } from 'lucide-react';
import type { Deal } from '@/lib/v4/types';
import { fmtMoney, cn } from '@/lib/v4/utils';
import { STAGES } from '@/lib/v4/constants';
import { savePlan, createTask } from '@/lib/v4/mutations';

interface PlanStep {
  id: string;
  title: string;
  target_date: string;
  stage_transition: string;
  focus: string[];
  talking_points: string[];
  risks: string[];
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

const FEAS_STYLE: Record<DealPlan['feasibility'], { label: string; className: string }> = {
  high:   { label: '高', className: 'bg-forest/15 text-forest border-forest/30' },
  medium: { label: '中', className: 'bg-brass/15 text-brass border-brass/30' },
  low:    { label: '低', className: 'bg-claret/10 text-claret border-claret/30' },
};

export function DealPlanPanel({ deal, isFixtures }: { deal: Deal; isFixtures: boolean }) {
  const [targetDate, setTargetDate] = useState<string>(defaultTargetDate(deal));
  const [extraContext, setExtraContext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<DealPlan | null>(null);

  async function generate() {
    if (busy) return;
    if (isFixtures) { setError('目前是 fixtures 模式(未接 Supabase),AI 生成路徑需要登入 + 真實案件'); return; }
    if (!targetDate) { setError('請選擇目標成交日'); return; }
    setBusy(true); setError(null); setPlan(null);
    try {
      const res = await fetch('/api/ai/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId: deal.id,
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

  const stageName = STAGES.find((s) => s.id === deal.stage)?.name;

  return (
    <div className="grid gap-5">
      {/* 客戶 context 列 */}
      <div className="grid gap-1.5 rounded-md border border-ink/10 bg-cream/40 p-4">
        <div className="label-caps text-ink/55">從這個案件推進</div>
        <div className="font-v4-serif text-xl font-semibold text-ink">{deal.name}</div>
        <div className="font-v4-mono text-[11px] text-ink/55 numeric">
          {fmtMoney(Number(deal.aum_usd))} · {deal.stage}{stageName ? ` · ${stageName}` : ''} · Tier {deal.tier ?? '—'}
        </div>
        {deal.next_step && <div className="mt-1 font-v4-mono text-[11px] text-ink/50">當前下一步:{deal.next_step}</div>}
      </div>

      {/* 輸入區 */}
      <section className="grid gap-3 rounded-md border border-ink/10 bg-paper p-5">
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
            placeholder="例如:配偶剛同意、銀行抽銀根、客戶下週出國一週..."
            className="rounded-md border border-ink/12 bg-cream/40 px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:border-ink/30 focus:outline-none"
            disabled={busy}
          />
        </label>
        <div className="flex items-center justify-between">
          <span className="font-v4-mono text-[10.5px] text-ink/45">Claude Opus 4.7 · 通常 30~60 秒</span>
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

      {plan && <PlanResult plan={plan} dealId={deal.id} isFixtures={isFixtures} />}

      {!plan && !busy && !error && (
        <div className="grid place-items-center gap-2 rounded-md border border-dashed border-ink/15 bg-paper/60 px-6 py-10 text-center">
          <Target className="h-5 w-5 text-ink/30" strokeWidth={1.5} />
          <div className="text-xs text-ink/55">填好目標日後按「生成成交路徑」</div>
        </div>
      )}
    </div>
  );
}

function PlanResult({ plan, dealId, isFixtures }: { plan: DealPlan; dealId: string; isFixtures: boolean }) {
  const feas = FEAS_STYLE[plan.feasibility];
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  async function handleSave() {
    if (saving || isFixtures) {
      if (isFixtures) { setSaveErr('fixtures 模式無法儲存'); return; }
      return;
    }
    setSaving(true); setSaveErr(null);
    try {
      await savePlan(dealId, plan);
      setSaved(true);
      startTransition(() => router.refresh());
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveErr((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="grid gap-3">
      <div className="flex items-baseline justify-between">
        <div className="label-caps text-ink/50 inline-flex items-center gap-2">
          <Sparkles className="h-3 w-3 text-cobalt" strokeWidth={2} />
          AI 規劃成果 · {plan.model}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || saved}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-paper transition',
            saved ? 'bg-forest' : 'bg-ink hover:bg-graphite',
            'disabled:cursor-not-allowed disabled:opacity-60',
          )}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : saved ? <Check className="h-3.5 w-3.5" strokeWidth={2} /> : <Save className="h-3.5 w-3.5" strokeWidth={2} />}
          {saving ? '儲存中…' : saved ? '已儲存' : '儲存此 plan'}
        </button>
      </div>
      {saveErr && <div className="rounded-md border border-claret/30 bg-claret/5 px-3 py-2 text-xs text-claret">{saveErr}</div>}

      <article className="grid gap-3 rounded-md border border-ink/10 bg-paper p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1.5">
            <div className="label-caps text-ink/55">總覽</div>
            <p className="text-sm leading-6 text-ink whitespace-pre-wrap">{plan.overview}</p>
          </div>
          <div className={cn('shrink-0 rounded-md border px-2.5 py-1.5 text-center', feas.className)}>
            <div className="font-v4-mono text-[9px] uppercase tracking-widest">可行性</div>
            <div className="font-v4-serif text-2xl font-semibold leading-none">{feas.label}</div>
          </div>
        </div>
        <div className="border-t border-ink/8 pt-2 text-xs leading-5 text-ink/70">{plan.feasibility_reason}</div>
      </article>

      {plan.top_risks.length > 0 && (
        <article className="grid gap-2 rounded-md border border-ink/10 bg-paper p-4">
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

      {plan.steps.length > 0 && (
        <article className="grid gap-2">
          <div className="label-caps text-ink/55">步驟 ({plan.steps.length})</div>
          <ol className="grid gap-2">
            {plan.steps.map((step, idx) => (
              <li key={step.id ?? idx} className="grid grid-cols-[auto_1fr] items-start gap-3 rounded-md border border-ink/10 bg-paper p-4">
                <div className="grid h-8 w-8 place-items-center rounded-md bg-forest/10 font-v4-serif text-base font-semibold text-forest numeric">{idx + 1}</div>
                <div className="grid gap-1.5">
                  <div className="grid grid-cols-[1fr_auto] items-baseline gap-2">
                    <div className="text-sm font-semibold text-ink">{step.title}</div>
                    <span className="rounded-sm px-1.5 py-0.5 text-[9.5px] font-v4-mono font-semibold uppercase tracking-widest stage-L4">{step.stage_transition}</span>
                  </div>
                  <div className="font-v4-mono text-[10.5px] text-ink/55 numeric">
                    <Calendar className="inline h-2.5 w-2.5 mb-0.5 mr-1" strokeWidth={2} />{step.target_date}
                  </div>
                  {step.focus.length > 0 && (
                    <FocusList step={step} dealId={dealId} isFixtures={isFixtures} />
                  )}
                  {step.talking_points.length > 0 && (
                    <div className="grid gap-1">
                      <div className="label-caps text-ink/50 inline-flex items-center gap-1.5"><MessageSquare className="h-2.5 w-2.5" strokeWidth={2} /> 話術</div>
                      <ul className="grid gap-0.5">
                        {step.talking_points.map((t, i) => <li key={i} className="text-xs leading-5 text-ink/75">「{t}」</li>)}
                      </ul>
                    </div>
                  )}
                  {step.risks.length > 0 && (
                    <div className="grid gap-1">
                      <div className="label-caps text-claret/80 inline-flex items-center gap-1.5"><AlertTriangle className="h-2.5 w-2.5" strokeWidth={2} /> 風險</div>
                      <ul className="grid gap-0.5">
                        {step.risks.map((r, i) => <li key={i} className="flex items-start gap-2 text-xs text-ink/75"><span className="mt-1.5 grid h-1 w-1 shrink-0 rounded-full bg-claret/60" /><span>{r}</span></li>)}
                      </ul>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </article>
      )}
    </section>
  );
}

// ============================================================
// FocusList — step.focus[] 加 checkbox + 升級為任務按鈕
// ============================================================
function FocusList({ step, dealId, isFixtures }: { step: PlanStep; dealId: string; isFixtures: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [picked, setPicked] = useState<boolean[]>(() => step.focus.map(() => true));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pickedCount = picked.filter(Boolean).length;

  async function promote() {
    if (busy || pickedCount === 0) return;
    if (isFixtures) { setErr('fixtures 模式無法寫入'); return; }
    setBusy(true); setErr(null);
    try {
      for (let i = 0; i < step.focus.length; i++) {
        if (picked[i]) {
          await createTask({
            deal_id: dealId,
            title: step.focus[i],
            description: `(${step.stage_transition}) ${step.title}`,
            due_date: step.target_date,
            priority: 'normal',
            status: 'todo',
          });
        }
      }
      setDone(true);
      startTransition(() => router.refresh());
      setTimeout(() => setDone(false), 2000);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="label-caps text-ink/50 inline-flex items-center gap-1.5"><ListChecks className="h-2.5 w-2.5" strokeWidth={2} /> 核心動作</div>
        <button
          type="button"
          onClick={promote}
          disabled={busy || done || pickedCount === 0}
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-v4-mono text-[10px] font-semibold transition',
            done ? 'bg-forest text-paper' : 'border border-ink/15 bg-paper text-ink/75 hover:border-ink/30 hover:text-ink',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {busy ? <Loader2 className="h-2.5 w-2.5 animate-spin" strokeWidth={2} /> : done ? <Check className="h-2.5 w-2.5" strokeWidth={2.5} /> : <ListTodo className="h-2.5 w-2.5" strokeWidth={2} />}
          {busy ? '建立中…' : done ? '已建立' : `升級 ${pickedCount} 項為任務`}
        </button>
      </div>
      <ul className="grid gap-0.5">
        {step.focus.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-ink/85">
            <button
              type="button"
              onClick={() => setPicked((p) => p.map((x, j) => j === i ? !x : x))}
              disabled={isFixtures || busy}
              className={cn(
                'mt-1 grid h-3 w-3 shrink-0 place-items-center rounded-sm border transition',
                picked[i] ? 'border-forest bg-forest text-paper' : 'border-ink/30 bg-paper hover:border-ink/50',
              )}
              aria-pressed={picked[i]}
            >
              {picked[i] && <Check className="h-2 w-2" strokeWidth={3} />}
            </button>
            <span className={cn('whitespace-pre-wrap', !picked[i] && 'opacity-50 line-through')}>{f}</span>
          </li>
        ))}
      </ul>
      {err && <div className="text-[11px] text-claret">{err}</div>}
    </div>
  );
}

function todayStr(): string { return new Date().toISOString().slice(0, 10); }
function defaultTargetDate(deal: Deal | undefined | null): string {
  if (deal?.target_close_date) return deal.target_close_date;
  const d = new Date(); d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}
