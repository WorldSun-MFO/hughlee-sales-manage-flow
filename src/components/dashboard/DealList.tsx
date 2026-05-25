// ============================================================
// 案件卡列表 — 整個 CRM 的主視覺
// ============================================================
// 顯示經過 filter 與 sort 的案件清單。每張卡片包含:
//   - Stage badge + Tier badge(左)
//   - 客戶名 + RM + 逾期/警示徽章 + 紅旗徽章
//   - AUM + 總分
//   - MEDDIC 進度條(總分 / 80)
//   - 「下一步」黃色提示框(若有)
//
// 點卡 → 父層 onOpenDeal(id) → 開 DealDetail modal
//
// 不碰 DB。Filter/sort 邏輯在父層算好再傳進來。
// ============================================================
'use client';

import type { Deal, Settings, TierConfigItem } from '@/lib/types';
import { TIER_STYLES } from '@/lib/constants';
import { fmtMoney, totalScore, daysSince, redFlag, contactOverdue } from '@/lib/utils';

interface Props {
  deals: Deal[];      // 已 filter + sort
  settings: Settings;
  tierCfg: TierConfigItem[];
  onOpenDeal: (id: string) => void;
}

export function DealList({ deals, settings, tierCfg, onOpenDeal }: Props) {
  if (deals.length === 0) {
    return <div className="text-center py-10 text-slate-400 text-sm">沒有符合條件的案件</div>;
  }
  return (
    <section className="space-y-2">
      {deals.map(d => (
        <DealCard key={d.id} deal={d} settings={settings} tierCfg={tierCfg} onClick={() => onOpenDeal(d.id)} />
      ))}
    </section>
  );
}

// 單張案件卡 — 卡片內部完全展示,點擊行為交給父層
function DealCard({ deal: d, settings, tierCfg, onClick }: { deal: Deal; settings: Settings; tierCfg: TierConfigItem[]; onClick: () => void }) {
  const contact = contactOverdue(d, tierCfg);
  const flag = redFlag(d, settings);
  return (
    <button onClick={onClick} className="w-full text-left bg-white rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-sm transition p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0 flex flex-col gap-1">
          <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-lg flex flex-col items-center justify-center font-bold text-xs stage-${d.stage}`}>
            <div>{d.stage}</div>
            <div className="text-[10px] font-normal opacity-80">{settings.stage_probs[d.stage]}%</div>
          </div>
          {d.tier && (
            <div className={`text-[10px] font-bold text-center rounded px-1 py-0.5 ${TIER_STYLES[d.tier] ?? 'bg-slate-200'}`}>
              {d.tier}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <div className="font-semibold text-sm sm:text-base flex items-center gap-2 flex-wrap">
                <span>{d.name}</span>
                <span className="text-xs text-slate-400 font-normal">RM {d.rm?.full_name || '—'}</span>
                {contact?.status === 'overdue' && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">🔔 逾期 {contact.deltaDays} 天未聯繫</span>}
                {contact?.status === 'due_soon' && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-100">🔔 {Math.abs(contact.deltaDays)} 天內需聯繫</span>}
                {flag && <span className="text-xs px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">🚩 {flag}</span>}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">{d.product}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm sm:text-base font-semibold">{fmtMoney(Number(d.aum_usd))}</div>
              <div className="text-xs text-slate-500">{totalScore(d)}/80 分</div>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500" style={{ width: `${totalScore(d) / 80 * 100}%` }} />
            </div>
            <span>{daysSince(d.last_updated)} 天前更新</span>
          </div>
          {d.next_step && (
            <div className="mt-2 text-xs bg-amber-50 text-amber-900 px-2 py-1 rounded border border-amber-100">
              <span className="font-semibold">下一步:</span> {d.next_step}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
