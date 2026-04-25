'use client';
import { useState } from 'react';
import type { Deal, DealPlan } from '@/lib/types';

interface Props {
  deal: Deal;
  onClose: () => void;
  onSavePlan: (plan: DealPlan, targetDate: string) => Promise<void>;
}

export function PlanModal({ deal, onClose, onSavePlan }: Props) {
  const defaultDate = deal.target_close_date
    || new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  const [targetDate, setTargetDate] = useState(defaultDate);
  const [extraContext, setExtraContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<DealPlan | null>(deal.plan);
  const [saving, setSaving] = useState(false);

  async function generate() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/ai/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id, targetCloseDate: targetDate, extraContext: extraContext.trim() || undefined }),
      });
      // 防呆:如果回應不是 JSON(例如 Vercel timeout 回 HTML),給更明確的錯誤訊息
      const raw = await res.text();
      let json: { data?: DealPlan; error?: string };
      try {
        json = JSON.parse(raw);
      } catch {
        if (res.status === 504 || res.status === 408) {
          throw new Error('AI 規劃超時(>60 秒),請重試或縮短目標期程');
        }
        throw new Error(`回應格式錯誤(HTTP ${res.status}):${raw.slice(0, 200)}`);
      }
      if (!res.ok) throw new Error(json.error || '產生計畫失敗');
      setPlan(json.data as DealPlan);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!plan) return;
    setSaving(true);
    try {
      await onSavePlan(plan, targetDate);
      onClose();
    } catch (err) {
      setError('儲存失敗:' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const feasBadge = plan ? (
    plan.feasibility === 'high' ? 'bg-emerald-100 text-emerald-700'
      : plan.feasibility === 'medium' ? 'bg-amber-100 text-amber-700'
      : 'bg-rose-100 text-rose-700'
  ) : '';

  const feasLabel = plan ? (
    plan.feasibility === 'high' ? '可行性高'
      : plan.feasibility === 'medium' ? '可行性中等'
      : '可行性低 · 風險大'
  ) : '';

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/50 z-40" onClick={onClose} />
      <div className="fixed inset-x-4 top-8 bottom-8 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[720px] sm:top-10 sm:bottom-10 bg-white rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-indigo-600 text-white flex items-center justify-center font-bold">🎯</div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">AI 成交路徑規劃</div>
            <div className="text-xs text-slate-500 truncate">{deal.name} · 目前 {deal.stage}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded hover:bg-slate-100">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className="block">
              <span className="text-xs text-slate-500">目標成交日</span>
              <input
                type="date"
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs text-slate-500">額外指示 (選填)</span>
              <input
                type="text"
                value={extraContext}
                onChange={e => setExtraContext(e.target.value)}
                placeholder="例:客戶下個月出國,5 月中前要簽約"
                className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
              />
            </label>
          </div>

          <button
            onClick={generate}
            disabled={loading}
            className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold disabled:opacity-50 hover:shadow"
          >
            {loading ? '🤖 AI 分析並規劃中... (約 15-30 秒)' : plan ? '🔄 重新產生計畫' : '🎯 請 AI 規劃成交路徑'}
          </button>

          {error && <div className="text-sm text-rose-600 bg-rose-50 p-3 rounded">{error}</div>}

          {plan && (
            <>
              <div className="p-3 border border-slate-200 rounded-lg bg-slate-50 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${feasBadge}`}>{feasLabel}</span>
                  <span className="text-xs text-slate-500">· {plan.feasibility_reason}</span>
                </div>
                <div className="text-sm text-slate-800 whitespace-pre-wrap">{plan.overview}</div>
                {plan.top_risks.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-rose-700 mt-2 mb-1">🚨 主要風險</div>
                    <ul className="text-xs text-slate-700 space-y-0.5">
                      {plan.top_risks.map((r, i) => <li key={i}>• {r}</li>)}
                    </ul>
                  </div>
                )}
              </div>

              <div>
                <div className="text-sm font-semibold mb-2">📍 路徑里程碑 ({plan.steps.length} 步)</div>
                <div className="space-y-2">
                  {plan.steps.map((step, i) => (
                    <div key={step.id} className="border border-slate-200 rounded-lg p-3 bg-white">
                      <div className="flex items-start gap-2 mb-2">
                        <div className="shrink-0 w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm">{step.title}</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {step.target_date} · {step.stage_transition}
                          </div>
                        </div>
                      </div>
                      {step.focus.length > 0 && (
                        <div className="text-xs mb-1.5">
                          <span className="font-semibold text-slate-600">🎯 核心動作:</span>
                          <ul className="mt-1 space-y-0.5 pl-4">
                            {step.focus.map((f, j) => <li key={j} className="list-disc text-slate-700">{f}</li>)}
                          </ul>
                        </div>
                      )}
                      {step.talking_points.length > 0 && (
                        <div className="text-xs mb-1.5">
                          <span className="font-semibold text-indigo-600">💬 建議話術:</span>
                          <ul className="mt-1 space-y-0.5 pl-4">
                            {step.talking_points.map((t, j) => <li key={j} className="list-disc text-slate-700">「{t}」</li>)}
                          </ul>
                        </div>
                      )}
                      {step.risks.length > 0 && (
                        <div className="text-xs">
                          <span className="font-semibold text-rose-600">⚠️ 風險:</span>
                          <ul className="mt-1 space-y-0.5 pl-4">
                            {step.risks.map((r, j) => <li key={j} className="list-disc text-slate-700">{r}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {plan && (
          <div className="px-5 py-3 border-t border-slate-200 flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 text-sm border border-slate-200 rounded hover:bg-slate-50"
            >僅查看不儲存</button>
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded font-semibold hover:bg-emerald-700 disabled:opacity-50"
            >{saving ? '儲存中...' : '💾 儲存為此案件的計畫'}</button>
          </div>
        )}
      </div>
    </>
  );
}
