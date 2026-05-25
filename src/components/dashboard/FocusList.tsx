// ============================================================
// 🎯 今日追蹤清單 — 該被處理的客戶 Top 10
// ============================================================
// 顯示「現在最該理的」案件,以 urgencyScore 排序取前 10 名。
// 排序規則見 lib/utils.ts 的 priorityReason / urgencyScore:
//   紅旗 > 逾期聯繫 > 2 週警示 > L4+ 卡關 > 即將到期,再以 tier 加權
//
// 互動:
//   - 📞 剛聯繫 → 觸發父層 onQuickLogContact(寫 deals.last_contact_at + 系統註解)
//   - 詳情 → 觸發父層 onOpenDeal(打開 DealDetail modal)
//   - 收起/展開 → 純 UI state(由父層持有)
// ============================================================
'use client';

import type { Deal, Settings, TierConfigItem } from '@/lib/types';
import { TIER_STYLES } from '@/lib/constants';
import { fmtMoney, priorityReason, urgencyScore } from '@/lib/utils';
import { useMemo } from 'react';

interface Props {
  deals: Deal[];
  settings: Settings;
  tierCfg: TierConfigItem[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenDeal: (id: string) => void;
  onQuickLogContact: (id: string) => void;
}

export function FocusList({ deals, settings, tierCfg, collapsed, onToggleCollapsed, onOpenDeal, onQuickLogContact }: Props) {
  const priorityDeals = useMemo(() => {
    return deals
      .map(d => ({ deal: d, score: urgencyScore(d, settings, tierCfg) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(x => x.deal);
  }, [deals, settings, tierCfg]);

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          🎯 今日追蹤清單
          <span className="text-xs font-normal text-slate-400">({priorityDeals.length} 件)</span>
        </h2>
        <button onClick={onToggleCollapsed} className="text-xs text-slate-400 hover:text-slate-600">
          {collapsed ? '展開 ▼' : '收起 ▲'}
        </button>
      </div>
      {!collapsed && (
        <>
          {priorityDeals.length === 0 && (
            <div className="text-center py-6 text-emerald-600 text-sm font-medium">
              🎉 沒有待追蹤的案件,全部健康!
            </div>
          )}
          <div className="space-y-1.5">
            {priorityDeals.map(d => {
              const reason = priorityReason(d, settings, tierCfg);
              if (!reason) return null;
              const toneClass = reason.tone === 'rose' ? 'text-rose-600' : reason.tone === 'orange' ? 'text-orange-600' : 'text-amber-600';
              return (
                <div key={d.id} className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 hover:bg-slate-50">
                  <div className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${TIER_STYLES[d.tier ?? ''] ?? 'bg-slate-200'}`}>
                    {d.tier ?? '?'}
                  </div>
                  <div className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded stage-${d.stage}`}>
                    {d.stage}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-sm truncate">{d.name}</span>
                      <span className="text-xs text-slate-400">{d.rm?.full_name ?? '—'}</span>
                      <span className="text-xs text-slate-400">· {fmtMoney(Number(d.aum_usd))}</span>
                    </div>
                    <div className={`text-xs ${toneClass} font-medium`}>{reason.icon} {reason.text}</div>
                    {d.next_step && (
                      <div className="text-[11px] text-slate-500 mt-0.5 truncate">👉 {d.next_step}</div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => onQuickLogContact(d.id)}
                      title="標記剛聯繫過,重新計算週期"
                      className="text-[11px] px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 whitespace-nowrap"
                    >📞 剛聯繫</button>
                    <button
                      onClick={() => onOpenDeal(d.id)}
                      className="text-[11px] px-2 py-1 border border-slate-200 rounded hover:bg-white whitespace-nowrap"
                    >詳情</button>
                  </div>
                </div>
              );
            })}
          </div>
          {priorityDeals.length > 0 && (
            <div className="mt-2 text-[11px] text-slate-400">
              優先度規則:紅旗 &gt; 逾期聯繫 &gt; L4+ 卡關 &gt; 即將到期;以 tier 加權
            </div>
          )}
        </>
      )}
    </section>
  );
}
