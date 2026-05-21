'use client';

import { useState, useMemo } from 'react';
import { ChevronRight, Sparkles, Target, Wand2 } from 'lucide-react';
import type { Snapshot, Deal } from '@/lib/v4/types';
import { fmtMoney, cn } from '@/lib/v4/utils';
import { STAGES } from '@/lib/v4/constants';

interface PlanStep {
  id: string;
  title: string;
  detail: string;
  stage: string;
}

export function PlanView({ snapshot, base = '/v4/workspace' }: { snapshot: Snapshot; base?: string }) {
  void base;
  const activeDeals = useMemo(
    () => snapshot.deals.filter((d) => d.stage !== 'L7').sort((a, b) => Number(b.aum_usd) - Number(a.aum_usd)),
    [snapshot.deals],
  );
  const [selectedId, setSelectedId] = useState<string | null>(activeDeals[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<PlanStep[] | null>(null);

  const selectedDeal = activeDeals.find((d) => d.id === selectedId) ?? null;

  const generate = () => {
    if (!selectedDeal) return;
    setBusy(true);
    setPlan(null);
    setTimeout(() => {
      // Phase 1 假計畫,Phase 2 接 /api/ai/generate-plan
      setPlan(makeMockPlan(selectedDeal));
      setBusy(false);
    }, 800);
  };

  return (
    <div className="mx-auto grid min-h-[calc(100vh-1px)] max-w-[1240px] grid-cols-1 gap-6 px-6 pb-10 pt-12 lg:grid-cols-[360px_1fr] lg:px-10">
      <aside className="grid content-start gap-4">
        <header className="grid gap-1.5">
          <div className="label-caps text-ink/45">挑一個案件</div>
          <h2 className="font-v4-serif text-2xl font-medium leading-tight text-ink">活躍案件</h2>
          <p className="text-xs text-ink/55 numeric">{activeDeals.length} 個,按 AUM 排序</p>
        </header>
        <ol className="grid gap-1.5">
          {activeDeals.map((d) => {
            const active = d.id === selectedId;
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => { setSelectedId(d.id); setPlan(null); }}
                  className={cn(
                    'grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-md border px-3.5 py-2.5 text-left transition',
                    active
                      ? 'border-ink/40 bg-paper shadow-chip'
                      : 'border-ink/8 bg-paper/60 hover:border-ink/20 hover:bg-paper',
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

      <main className="grid content-start gap-6">
        <header className="grid gap-2">
          <div className="label-caps text-ink/45">成交路徑規劃</div>
          <h1 className="font-v4-serif text-[44px] font-medium leading-[0.95] tracking-tight text-ink lg:text-[56px]">
            {selectedDeal ? <>從 <span className="italic text-forest">{selectedDeal.stage}</span> 到成交</> : '選一個案件開始'}
          </h1>
          {selectedDeal && (
            <p className="mt-1 text-sm leading-6 text-ink/65 max-w-2xl">
              {selectedDeal.name} · {fmtMoney(Number(selectedDeal.aum_usd))} · {STAGES.find((s) => s.id === selectedDeal.stage)?.name}
              {selectedDeal.next_step ? ` · 目前下一步:${selectedDeal.next_step}` : ''}
            </p>
          )}
        </header>

        {selectedDeal && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={generate}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-paper transition hover:bg-graphite disabled:bg-ink/40"
            >
              <Wand2 className="h-4 w-4" strokeWidth={1.75} />
              {busy ? '生成中…' : plan ? '重新規劃' : '生成成交路徑'}
            </button>
            <span className="font-v4-mono text-[11px] text-ink/45">Phase 2 將接上 Claude Opus 4.7</span>
          </div>
        )}

        {plan && (
          <section className="grid gap-3">
            <div className="label-caps text-ink/50">建議步驟</div>
            <ol className="grid gap-2">
              {plan.map((step, idx) => (
                <li key={step.id} className="grid grid-cols-[auto_1fr_auto] items-start gap-4 rounded-md border border-ink/10 bg-paper p-5">
                  <div className="grid h-9 w-9 place-items-center rounded-md bg-forest/10 font-v4-serif text-lg font-semibold text-forest numeric">
                    {idx + 1}
                  </div>
                  <div className="grid gap-1.5">
                    <div className="text-base font-semibold text-ink">{step.title}</div>
                    <p className="text-sm leading-6 text-ink/70">{step.detail}</p>
                  </div>
                  <span className="rounded-sm px-2 py-1 text-[10px] font-v4-mono font-semibold uppercase tracking-widest stage-L4">
                    {step.stage}
                  </span>
                </li>
              ))}
            </ol>
            <footer className="mt-2 flex items-center gap-2 font-v4-mono text-[11px] text-ink/45">
              <Sparkles className="h-3 w-3 text-cobalt" strokeWidth={2} />
              <span>步驟依照 MEDDIC playbook 與當前 stage 配置;Phase 2 接 AI 後會根據 scores / comments 客製化</span>
            </footer>
          </section>
        )}

        {!plan && !busy && selectedDeal && (
          <div className="grid place-items-center gap-2 rounded-md border border-dashed border-ink/15 bg-paper/60 px-6 py-12 text-center">
            <Target className="h-6 w-6 text-ink/30" strokeWidth={1.5} />
            <div className="text-sm text-ink/55">按上方按鈕生成這個案件的成交路徑</div>
          </div>
        )}
      </main>
    </div>
  );
}

function makeMockPlan(deal: Deal): PlanStep[] {
  const currentIdx = ['L1','L2','L3','L4','L5','L6','L7'].indexOf(deal.stage);
  const template: Array<Omit<PlanStep, 'id' | 'stage'>> = [
    { title: '確認決策者全到位', detail: 'EB(經濟買家)是否親口確認?還是只有窗口?若窗口傳話,主動爭取 30 分鐘同席會議。' },
    { title: '量化痛點(I)', detail: '把客戶最在意的傳承 / 稅務 / 流動性等議題,用具體數字呈現「不做」的代價,而非「做」的好處。' },
    { title: '送出客製提案', detail: '不要丟標準提案。一頁式、針對該客戶的決策標準(D2)排序設計,附上壓測情境。' },
    { title: '處理異議與替代方案', detail: '預想前 3 個會被問的問題,提前準備 alternative。最好用 metrics(M)講話。' },
    { title: '推進核保 / 融資', detail: '一旦客戶 verbal commit,立刻把 paperwork 進度卡死(7 天內 close paperwork),否則案子會冷掉。' },
    { title: '成交後請求轉介', detail: '在簽約後 14 天內、客戶滿意度最高時,開口請 2 位高品質轉介。這是 SSS Tier 來源。' },
  ];
  return template.slice(currentIdx).map((step, i) => ({
    id: `step-${i}`,
    ...step,
    stage: ['L1','L2','L3','L4','L5','L6','L7'][currentIdx + i] ?? 'L7',
  }));
}
