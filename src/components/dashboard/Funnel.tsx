// ============================================================
// 漏斗階段分佈條圖 — L1-L7 件數與 AUM
// ============================================================
// 顯示七階段的件數 + 總 AUM,寬度依該階段件數佔 max 比例。
// 點階段條 → 套用 stage filter(再點一次取消)。
//
// 不碰 DB。所有資料來自父層傳入的 deals。
// ============================================================
'use client';

import type { Deal, StageId } from '@/lib/types';
import { STAGES } from '@/lib/constants';
import { fmtMoney } from '@/lib/utils';

interface Props {
  deals: Deal[];
  filterStage: StageId | '';
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onSetStageFilter: (next: StageId | '') => void;
}

export function Funnel({ deals, filterStage, collapsed, onToggleCollapsed, onSetStageFilter }: Props) {
  const stageCount = (id: StageId) => deals.filter(d => d.stage === id).length;
  const stageAum = (id: StageId) => deals.filter(d => d.stage === id).reduce((s, d) => s + Number(d.aum_usd ?? 0), 0);
  const stageBarPct = (id: StageId) => {
    const maxCount = Math.max(1, ...STAGES.map(s => stageCount(s.id)));
    return stageCount(id) / maxCount * 100;
  };
  const l4PlusCount = deals.filter(d => ['L4', 'L5', 'L6', 'L7'].includes(d.stage)).length;
  const l4PlusPct = deals.length ? Math.round((l4PlusCount / deals.length) * 100) : 0;

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm">漏斗階段分佈</h2>
        <div className="flex items-center gap-3">
          {filterStage && (
            <button
              onClick={() => onSetStageFilter('')}
              className="text-xs text-indigo-600 hover:underline"
            >清除階段篩選</button>
          )}
          <button onClick={onToggleCollapsed} className="text-xs text-slate-400 hover:text-slate-600">
            {collapsed ? '展開 ▼' : '收起 ▲'}
          </button>
        </div>
      </div>
      {!collapsed && (
        <>
          <div className="space-y-2">
            {STAGES.map(stage => (
              <button
                key={stage.id}
                // 點同一階段第二次 = 取消篩選
                onClick={() => onSetStageFilter(filterStage === stage.id ? '' : stage.id)}
                className={`w-full flex items-center gap-3 p-2 rounded-lg transition ${filterStage === stage.id ? 'ring-2 ring-indigo-400 bg-indigo-50' : 'hover:bg-slate-50'}`}
              >
                <div className="w-10 text-xs font-bold text-right">{stage.id}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-xs text-slate-600 truncate">{stage.name}</div>
                    <div className="text-xs text-slate-400">推進率目標 {stage.targetConv}</div>
                  </div>
                  <div className="h-6 rounded-md relative overflow-hidden border border-slate-200 bg-slate-50">
                    <div className={`h-full stage-${stage.id} transition-all duration-500 flex items-center px-2`} style={{ width: `${Math.max(stageBarPct(stage.id), 4)}%` }}>
                      <span className="text-xs font-semibold whitespace-nowrap">{stageCount(stage.id)} 件</span>
                    </div>
                    <div className="absolute right-2 top-0 h-full flex items-center">
                      <span className="text-xs font-medium text-slate-600">{fmtMoney(stageAum(stage.id))}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
            總案件 <span className="font-semibold text-slate-700">{deals.length}</span> · L4+ 佔比 {l4PlusPct}% (建議 ≥25%) · Pipeline 覆蓋率建議 ≥ 3× 月目標
          </div>
        </>
      )}
    </section>
  );
}
