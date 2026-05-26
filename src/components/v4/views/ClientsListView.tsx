'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Search } from 'lucide-react';
import type { Profile, Snapshot, StageId, Tier } from '@/lib/v4/types';
import { STAGES } from '@/lib/v4/constants';
import { daysSince, fmtMoney, totalScore, TIER_STYLES } from '@/lib/v4/utils';
import { AddDealButton } from '@/components/v4/AddDealButton';
import { RealtimeRefresher } from '@/components/v4/RealtimeRefresher';

type SortKey = 'aum_desc' | 'aum_asc' | 'updated_desc' | 'updated_asc' | 'score_desc' | 'score_asc' | 'name_asc';

const TIERS_ORDER: Tier[] = ['SSS', 'S', 'A', 'B', 'C'];

export function ClientsListView({ snapshot, base, profile }: { snapshot: Snapshot; base: '/workspace' | '/hub'; profile: Profile | null }) {
  const isFixtures = snapshot.source === 'fixtures';
  const [q, setQ] = useState('');
  const [stage, setStage] = useState<StageId | ''>('');
  const [rmId, setRmId] = useState<string>('');
  const [teamId, setTeamId] = useState<string>('');
  const [sortKey, setSortKey] = useState<SortKey>('aum_desc');

  const activeRMs = useMemo(() => {
    const ids = new Set(snapshot.deals.map((d) => d.rm_id));
    return snapshot.profiles.filter((p) => ids.has(p.id));
  }, [snapshot.deals, snapshot.profiles]);

  const filtered = useMemo(() => {
    const query = q.toLowerCase().trim();
    return snapshot.deals.filter((d) => {
      if (stage && d.stage !== stage) return false;
      if (rmId && d.rm_id !== rmId) return false;
      if (teamId) {
        const rm = snapshot.profiles.find((p) => p.id === d.rm_id);
        if (rm?.team_id !== teamId) return false;
      }
      if (query && !`${d.name} ${d.product ?? ''} ${d.next_step ?? ''}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [snapshot.deals, snapshot.profiles, q, stage, rmId, teamId]);

  function sortDeals(list: typeof filtered) {
    return list.slice().sort((a, b) => {
      switch (sortKey) {
        case 'aum_desc': return Number(b.aum_usd) - Number(a.aum_usd);
        case 'aum_asc': return Number(a.aum_usd) - Number(b.aum_usd);
        case 'updated_desc': return daysSince(a.last_updated) - daysSince(b.last_updated);
        case 'updated_asc': return daysSince(b.last_updated) - daysSince(a.last_updated);
        case 'score_desc': return totalScore(b) - totalScore(a);
        case 'score_asc': return totalScore(a) - totalScore(b);
        case 'name_asc': return a.name.localeCompare(b.name);
      }
    });
  }

  const hasFilter = !!(q || stage || rmId || teamId);

  return (
    <div className="grid gap-10 px-4 py-6 sm:px-8 sm:py-10 lg:px-14 lg:py-14">
      <RealtimeRefresher isFixtures={isFixtures} tables={['deals', 'scores']} />
      <header className="grid gap-2">
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className="grid gap-2 min-w-0">
            <div className="label-caps text-ink/45">Clients</div>
            <h1 className="font-v4-serif text-[32px] font-medium leading-[1.05] tracking-tight text-ink sm:text-[44px] lg:text-[56px]">
              客戶名冊
            </h1>
          </div>
          <div className="pt-2 shrink-0">
            <AddDealButton base={base} isFixtures={isFixtures} profile={profile} profiles={snapshot.profiles} />
          </div>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-ink/65 sm:text-base sm:leading-7">
          以等級分組<br />
          每位客戶獨立頁面承載 MEDDIC 評分、對話紀錄、AI 路徑、任務
        </p>
      </header>

      {/* Filter bar */}
      <section className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex w-full items-center gap-2 rounded-md border border-ink/15 bg-paper px-2.5 py-1.5 sm:w-auto">
            <Search className="h-3.5 w-3.5 text-ink/45" strokeWidth={1.75} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜尋客戶 / 商品 / 下一步"
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink/35 sm:w-56"
            />
          </div>
          <FilterSelect value={stage} onChange={(v) => setStage(v as StageId | '')}>
            <option value="">全部階段</option>
            {STAGES.map((s) => (<option key={s.id} value={s.id}>{s.id} · {s.name}</option>))}
          </FilterSelect>
          <FilterSelect value={rmId} onChange={setRmId}>
            <option value="">全部 RM</option>
            {activeRMs.map((p) => (<option key={p.id} value={p.id}>{p.full_name ?? p.rm_code ?? p.email}</option>))}
          </FilterSelect>
          {snapshot.teams.length > 1 && (
            <FilterSelect value={teamId} onChange={setTeamId}>
              <option value="">全部團隊</option>
              {snapshot.teams.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
            </FilterSelect>
          )}
          <span className="font-v4-mono text-[11px] text-ink/45 ml-2">排序</span>
          <FilterSelect value={sortKey} onChange={(v) => setSortKey(v as SortKey)}>
            <option value="aum_desc">AUM ↓</option>
            <option value="aum_asc">AUM ↑</option>
            <option value="updated_desc">最新更新 ↓</option>
            <option value="updated_asc">最久未更新 ↑</option>
            <option value="score_desc">MEDDIC ↓</option>
            <option value="score_asc">MEDDIC ↑</option>
            <option value="name_asc">名稱 A→Z</option>
          </FilterSelect>
          {hasFilter && (
            <button
              type="button"
              onClick={() => { setQ(''); setStage(''); setRmId(''); setTeamId(''); }}
              className="font-v4-mono text-xs font-semibold text-ink/55 transition hover:text-ink"
            >
              清除 ✕
            </button>
          )}
          <span className="ml-auto font-v4-mono text-[11px] text-ink/45 numeric shrink-0">{filtered.length} / {snapshot.deals.length}</span>
        </div>
      </section>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-ink/15 bg-paper/60 px-6 py-12 text-center text-sm text-ink/45">
          沒有符合條件的客戶{hasFilter && '清除篩選看全部 ↑'}
        </div>
      ) : (
        TIERS_ORDER.map((tier) => {
          const deals = sortDeals(filtered.filter((d) => d.tier === tier));
          if (deals.length === 0) return null;
          const tierAum = deals.reduce((s, d) => s + Number(d.aum_usd), 0);
          const tierConfig = snapshot.tierConfig.find((t) => t.key === tier);
          return (
            <section key={tier} className="grid gap-4">
              <div className="flex flex-col gap-1 border-b border-ink/10 pb-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className={`rounded-sm px-2 py-1 font-v4-mono text-xs font-bold ${TIER_STYLES[tier]}`}>{tier}</span>
                  <span className="font-v4-serif text-lg font-medium text-ink sm:text-xl">{tierConfig?.name ?? tier}</span>
                  <span className="font-v4-mono text-xs text-ink/45 numeric">{deals.length} 位 · {fmtMoney(tierAum)}</span>
                </div>
                <div className="font-v4-mono text-[11px] text-ink/45">建議聯繫週期 {tierConfig?.contact_days ?? '—'} 天</div>
              </div>
              <ul className="grid gap-2">
                {deals.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`${base}/clients/${d.id}` as never}
                      className="group grid grid-cols-[52px_1fr_auto] items-center gap-3 rounded-md border border-ink/10 bg-paper p-3 transition hover:border-ink/25 hover:shadow-panel sm:grid-cols-[60px_1fr_120px_120px] sm:gap-4 sm:p-4"
                    >
                      <span className={`stage-${d.stage} grid h-9 place-items-center rounded-sm font-v4-mono text-xs font-bold`}>
                        {d.stage}
                      </span>
                      <div className="min-w-0">
                        <div className="font-v4-serif text-base font-semibold leading-tight text-ink sm:text-lg">
                          {d.name.replace(/^【範例】/, '')}
                        </div>
                        <div className="mt-1 truncate font-v4-mono text-[11px] text-ink/55 sm:text-xs">
                          {d.rm?.full_name ?? '—'} · {d.product ?? '—'}
                        </div>
                        {/* mobile-only: 分數 + AUM 緊湊行 */}
                        <div className="mt-2 flex items-center gap-3 sm:hidden">
                          <span className="font-v4-mono text-xs font-semibold text-ink numeric">{fmtMoney(Number(d.aum_usd))}</span>
                          <span className="font-v4-mono text-[11px] text-ink/55 numeric">{totalScore(d)}/80</span>
                          <div className="flex-1 h-1 overflow-hidden rounded-full bg-ink/8">
                            <div className="h-full bg-forest" style={{ width: `${(totalScore(d) / 80) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                      <div className="hidden text-xs text-ink/55 sm:block">
                        <span className="font-v4-mono numeric">{totalScore(d)}/80</span>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-ink/8">
                          <div className="h-full bg-forest" style={{ width: `${(totalScore(d) / 80) * 100}%` }} />
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <span className="hidden font-v4-mono text-base font-semibold text-ink numeric sm:inline">{fmtMoney(Number(d.aum_usd))}</span>
                        <ArrowUpRight className="h-4 w-4 text-ink/30 transition group-hover:text-ink" strokeWidth={1.75} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}

function FilterSelect({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-md border border-ink/15 bg-paper px-2.5 text-sm font-semibold text-ink outline-none transition hover:border-ink/30"
    >
      {children}
    </select>
  );
}
