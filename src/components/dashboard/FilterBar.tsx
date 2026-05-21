// ============================================================
// 篩選列 — RM / 團隊 / Tier / 逾期 / 紅旗 / 搜尋 / 排序
// ============================================================
// 純展示元件,把 filter state 完全交給父層。
// 父層用 reducer-style setter:setFilter(prev => ({ ...prev, key: val }))
//
// 互動規則:
//   - team 改變時,如果目前選的 RM 不屬於該 team → 清空 RM(避免不一致)
//   - tier / status / sort 直接寫回
//
// 不碰 DB。
// ============================================================
'use client';

import type { Profile, StageId, Team, Tier, TierConfigItem } from '@/lib/types';

export interface FilterState {
  rm: string;
  team: string;
  stage: StageId | '';
  tier: Tier | '';
  redFlag: boolean;
  overdue: boolean;
  search: string;
  sort: 'updated' | 'aum' | 'score' | 'stage';
}

interface Props {
  filter: FilterState;
  setFilter: (next: FilterState | ((prev: FilterState) => FilterState)) => void;
  profiles: Profile[];
  teams: Team[];
  tierCfg: TierConfigItem[];
}

export function FilterBar({ filter, setFilter, profiles, teams, tierCfg }: Props) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 p-3 flex flex-wrap gap-2 items-center">
      <select value={filter.rm} onChange={e => setFilter(f => ({ ...f, rm: e.target.value }))} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white">
        <option value="">所有 RM</option>
        {profiles.filter(p => !filter.team || p.team_id === filter.team).map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
      </select>
      {teams.length > 0 && (
        <select
          value={filter.team}
          onChange={e => {
            const team = e.target.value;
            // 切團隊時,若目前選的 RM 不屬於新團隊 → 清空 RM
            setFilter(f => ({ ...f, team, rm: team && f.rm && profiles.find(p => p.id === f.rm)?.team_id !== team ? '' : f.rm }));
          }}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white"
        >
          <option value="">所有團隊</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}
      <select value={filter.tier} onChange={e => setFilter(f => ({ ...f, tier: e.target.value as Tier | '' }))} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white">
        <option value="">所有等級</option>
        {tierCfg.map(t => <option key={t.key} value={t.key}>{t.key} {t.name}</option>)}
      </select>
      <label className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
        <input type="checkbox" checked={filter.overdue} onChange={e => setFilter(f => ({ ...f, overdue: e.target.checked }))} className="accent-amber-600" />
        <span>🔔 逾期聯繫</span>
      </label>
      <label className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
        <input type="checkbox" checked={filter.redFlag} onChange={e => setFilter(f => ({ ...f, redFlag: e.target.checked }))} className="accent-rose-600" />
        <span>🚩 紅旗</span>
      </label>
      <input type="search" value={filter.search} onChange={e => setFilter(f => ({ ...f, search: e.target.value }))} placeholder="搜尋客戶/商品/下一步..." className="flex-1 min-w-[140px] px-3 py-1.5 text-sm border border-slate-200 rounded-lg" />
      <select value={filter.sort} onChange={e => setFilter(f => ({ ...f, sort: e.target.value as FilterState['sort'] }))} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white">
        <option value="updated">排序:最近更新</option>
        <option value="aum">排序:AUM 大到小</option>
        <option value="score">排序:總分高到低</option>
        <option value="stage">排序:階段高到低</option>
      </select>
    </section>
  );
}
