// ============================================================
// 五張 KPI 磚 — Pipeline 總 AUM / 加權預測 / L4+ / 需聯繫 / 紅旗
// ============================================================
// 計算公式集中在這(原本散在 Dashboard.tsx),由父層只傳入 deals + settings。
//
// 兩張紅色磚可點 toggle filter(逾期 / 紅旗),點下去呼叫父層 callback。
//
// 不碰 DB,只做純計算。
// 計算邏輯來自:lib/utils.ts(redFlag、contactOverdue)
//              lib/constants.ts 的 settings.stage_probs
// ============================================================
'use client';

import { useMemo } from 'react';
import type { Deal, Settings, TierConfigItem } from '@/lib/types';
import { fmtMoney, redFlag, contactOverdue } from '@/lib/utils';

interface Props {
  deals: Deal[];
  settings: Settings;
  tierCfg: TierConfigItem[];
  filterOverdue: boolean;
  filterRedFlag: boolean;
  onToggleOverdue: () => void;
  onToggleRedFlag: () => void;
}

export function KpiTiles({ deals, settings, tierCfg, filterOverdue, filterRedFlag, onToggleOverdue, onToggleRedFlag }: Props) {
  // useMemo 收斂計算 — deals 變動才重算
  const stats = useMemo(() => {
    const active = deals.filter(d => d.stage !== 'L7');
    const totalAum = active.reduce((s, d) => s + Number(d.aum_usd ?? 0), 0);
    const weightedForecast = deals.reduce(
      (s, d) => s + Number(d.aum_usd ?? 0) * (settings.stage_probs[d.stage] ?? 0) / 100,
      0,
    );
    const l4PlusCount = deals.filter(d => ['L4', 'L5', 'L6', 'L7'].includes(d.stage)).length;
    const l4PlusPct = deals.length ? Math.round((l4PlusCount / deals.length) * 100) : 0;
    const redFlagCount = deals.filter(d => redFlag(d, settings)).length;
    const overdueCount = active.filter(d => contactOverdue(d, tierCfg)?.status === 'overdue').length;
    const dueSoonCount = active.filter(d => contactOverdue(d, tierCfg)?.status === 'due_soon').length;
    return { totalAum, weightedForecast, l4PlusCount, l4PlusPct, redFlagCount, activeDealsCount: active.length, overdueCount, dueSoonCount };
  }, [deals, settings, tierCfg]);

  return (
    <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <KpiTile label="Pipeline 總 AUM" value={fmtMoney(stats.totalAum)} hint={`${stats.activeDealsCount} 個活躍案件`} />
      <KpiTile label="加權預測" value={fmtMoney(stats.weightedForecast)} hint="依階段機率加權" valueClass="text-indigo-700" />
      <KpiTile label="L4+ 高品質" value={`${stats.l4PlusCount} 件`} hint={`佔比 ${stats.l4PlusPct}% (健康 ≥25%)`} valueClass="text-emerald-600" />
      <button onClick={onToggleOverdue} className="text-left">
        <KpiTile
          label="🔔 需聯繫"
          value={`${stats.overdueCount} 件`}
          hint={stats.dueSoonCount > 0 ? `+ ${stats.dueSoonCount} 件 3 天內到期` : '點此只看逾期'}
          valueClass={stats.overdueCount > 0 ? 'text-amber-600' : 'text-slate-400'}
          highlight={filterOverdue}
        />
      </button>
      <button onClick={onToggleRedFlag} className="text-left">
        <KpiTile
          label="🚩 紅旗"
          value={`${stats.redFlagCount} 件`}
          hint="EB 未確認/分低/久未更新"
          valueClass={stats.redFlagCount > 0 ? 'text-rose-600' : 'text-slate-400'}
          highlight={filterRedFlag}
        />
      </button>
    </section>
  );
}

// 單張磚的展示元件(highlight = 被當前 filter 選中時的視覺強調)
function KpiTile({ label, value, hint, valueClass, highlight }: { label: string; value: string; hint: string; valueClass?: string; highlight?: boolean }) {
  return (
    <div className={`bg-white rounded-xl border p-4 transition ${highlight ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-slate-200'}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-xl sm:text-2xl font-bold ${valueClass ?? ''}`}>{value}</div>
      <div className="text-xs text-slate-400 mt-1">{hint}</div>
    </div>
  );
}
