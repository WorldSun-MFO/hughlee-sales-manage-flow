'use client';

// ============================================================
// AI 助手 view(/v4/.../ai)— 對選定客戶執行 parse-interaction
// ============================================================
// v4.3 重構:右側面板直接用 <DealAIPanel>(跟客戶詳情頁 Drawer 同款),
// 自動帶來:
//   - 輸入文字 + 附檔上傳
//   - POST /api/ai/parse-interaction
//   - 顯示 score_updates / new_comment / next_step_update / stage_suggestion
//   - 「逐項勾選 + 套用回 deal」按鈕(原本這個頁面缺的)
//
// 跟 DealAIPanel 唯一差別:這頁多了左側客戶列表(讓 RM 可以切換),
// DealAIPanel 是給 Drawer 用的(deal 已知就不需要列表)。
// ============================================================
import { useState, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Snapshot, Deal } from '@/lib/v4/types';
import { fmtMoney, cn } from '@/lib/v4/utils';
import { STAGES } from '@/lib/v4/constants';
import { DealAIPanel } from '@/components/v4/DealAIPanel';

export function AIChatView({ snapshot, base = '/workspace' }: { snapshot: Snapshot; base?: string }) {
  const activeDeals = useMemo(
    () => snapshot.deals.filter((d) => d.stage !== 'L7').sort((a, b) => Number(b.aum_usd) - Number(a.aum_usd)),
    [snapshot.deals],
  );
  const [selectedId, setSelectedId] = useState<string | null>(activeDeals[0]?.id ?? null);
  const selectedDeal = activeDeals.find((d) => d.id === selectedId) ?? null;
  const isFixtures = snapshot.source === 'fixtures';

  return (
    <div className="mx-auto grid min-h-[calc(100vh-1px)] max-w-[1240px] grid-cols-1 gap-6 px-6 pb-10 pt-12 lg:grid-cols-[340px_1fr] lg:px-10">
      <DealList
        deals={activeDeals}
        selectedId={selectedId}
        onSelect={(id) => setSelectedId(id)}
      />

      <main className="grid content-start gap-6">
        <header className="grid gap-2">
          <div className="label-caps text-ink/45">AI 助手 · 客戶互動解析</div>
          <h1 className="font-v4-serif text-[44px] font-medium leading-[0.95] tracking-tight text-ink lg:text-[56px]">
            {selectedDeal
              ? <>跟 <span className="italic text-forest">{selectedDeal.name.split(' — ')[0] ?? selectedDeal.name}</span> 聊了什麼?</>
              : '選一個客戶開始'}
          </h1>
          {selectedDeal && <DealContextLine deal={selectedDeal} />}
        </header>

        {selectedDeal ? (
          // ★ 改用 DealAIPanel(跟客戶詳情頁 Drawer 同款 — 含 Apply 流程)
          //   傳 viewDealHref:套用後在底部顯示「→ 客戶頁面」連結
          <DealAIPanel
            key={selectedDeal.id}
            deal={selectedDeal}
            isFixtures={isFixtures}
            viewDealHref={`${base}/clients/${selectedDeal.id}`}
          />
        ) : (
          <div className="grid place-items-center gap-2 rounded-md border border-dashed border-ink/15 bg-paper/60 px-6 py-16 text-center">
            <div className="text-sm text-ink/55">左側選一個客戶開始解析</div>
          </div>
        )}
      </main>
    </div>
  );
}

// ============================================================
// 左側客戶列表
// ============================================================
function DealList({
  deals, selectedId, onSelect,
}: {
  deals: Deal[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
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
                  <div className="font-v4-mono text-[10px] text-ink/55 numeric">
                    {d.stage} · {fmtMoney(Number(d.aum_usd))} · {d.tier ?? '—'}
                  </div>
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
      {deal.next_step ? (
        <><br /><span className="font-v4-mono text-[11px] text-ink/50">當前下一步:{deal.next_step}</span></>
      ) : null}
    </p>
  );
}
