'use client';

// ============================================================
// 今日 / MEDDPICC tab — 一次掃完所有客戶的 MEDDIC 評分 + 實戰題庫
// ============================================================
// 設計:左側客戶列表(按總分由低排前,缺最多分的浮上來);
//      右側選定客戶的 ScoresClient(內含 8 字母評分 + 備註 + 實戰題庫)
//
// 跟舊客戶詳情頁的差異:
//   - 那邊是 server section 預先 fetch scores+notes+questions
//   - 這邊是 client side 點選後才 fetch(避免一次撈全部客戶的子表)
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import type { Deal, DealQuestion, ScoreNote, Snapshot } from '@/lib/v4/types';
import { STAGES } from '@/lib/v4/constants';
import { cn, totalScore } from '@/lib/v4/utils';
import { createClient } from '@/lib/supabase/client';
import { ScoresClient } from '@/components/v4/sections/ScoresClient';

type SortKey = 'score_asc' | 'score_desc' | 'aum_desc' | 'tier' | 'stage';
const SORT_LABELS: Record<SortKey, string> = {
  score_asc:  '總分低 → 高(預設:需要補強的浮頂)',
  score_desc: '總分高 → 低',
  aum_desc:   'AUM 高 → 低',
  tier:       'Tier(SSS → C)',
  stage:      'Stage(L1 → L7)',
};
const TIER_ORDER: Record<string, number> = { SSS: 0, S: 1, A: 2, B: 3, C: 4 };
const STAGE_ORDER: Record<string, number> = { L1: 0, L2: 1, L3: 2, L4: 3, L5: 4, L6: 5, L7: 6 };

export function MeddpiccTab({ snapshot }: { snapshot: Snapshot }) {
  const isFixtures = snapshot.source === 'fixtures';
  const [sortKey, setSortKey] = useState<SortKey>('score_asc');

  // 活躍案件(L7 已成交不列),按使用者選的 sort 排
  const activeDeals = useMemo(() => {
    const list = snapshot.deals.filter((d) => d.stage !== 'L7');
    list.sort((a, b) => {
      switch (sortKey) {
        case 'score_asc':  return totalScore(a) - totalScore(b);
        case 'score_desc': return totalScore(b) - totalScore(a);
        case 'aum_desc':   return Number(b.aum_usd) - Number(a.aum_usd);
        case 'tier':       return (TIER_ORDER[a.tier ?? 'C'] ?? 99) - (TIER_ORDER[b.tier ?? 'C'] ?? 99);
        case 'stage':      return (STAGE_ORDER[a.stage] ?? 99) - (STAGE_ORDER[b.stage] ?? 99);
      }
    });
    return list;
  }, [snapshot.deals, sortKey]);

  const [selectedId, setSelectedId] = useState<string | null>(activeDeals[0]?.id ?? null);
  const selectedDeal = activeDeals.find((d) => d.id === selectedId) ?? null;

  return (
    <section className="grid gap-4 lg:grid-cols-[320px_1fr] lg:gap-6">
      <DealList
        deals={activeDeals}
        selectedId={selectedId}
        onSelect={setSelectedId}
        sortKey={sortKey}
        onSortChange={setSortKey}
      />
      {selectedDeal ? (
        <MeddpiccPanel deal={selectedDeal} isFixtures={isFixtures} />
      ) : (
        <div className="grid place-items-center rounded-md border border-dashed border-ink/15 bg-paper/60 px-6 py-12">
          <div className="text-sm text-ink/55">沒有活躍案件可顯示</div>
        </div>
      )}
    </section>
  );
}

// ============================================================
// 左側客戶清單(按總分由低排前)
// ============================================================
function DealList({
  deals, selectedId, onSelect, sortKey, onSortChange,
}: {
  deals: Deal[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  sortKey: SortKey;
  onSortChange: (k: SortKey) => void;
}) {
  return (
    <aside className="grid content-start gap-2">
      <div className="grid gap-1.5">
        <label className="grid gap-1">
          <span className="label-caps text-ink/55">客戶排序</span>
          <select
            value={sortKey}
            onChange={(e) => onSortChange(e.target.value as SortKey)}
            className="rounded-md border border-ink/15 bg-paper px-2.5 py-1.5 text-sm text-ink focus:border-ink/40 focus:outline-none"
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k}>{SORT_LABELS[k]}</option>
            ))}
          </select>
        </label>
        <div className="font-v4-mono text-[11px] text-ink/45 numeric">共 {deals.length} 位</div>
      </div>
      <ol className="grid gap-1.5 lg:max-h-[70vh] lg:overflow-y-auto lg:pr-1">
        {deals.map((d) => {
          const total = totalScore(d);
          const pct = (total / 80) * 100;
          const tone = total < 30 ? 'bg-claret/70' : total < 50 ? 'bg-brass' : 'bg-forest';
          const active = d.id === selectedId;
          return (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => onSelect(d.id)}
                className={cn(
                  'grid w-full gap-1.5 rounded-md border px-3 py-2.5 text-left transition',
                  active
                    ? 'border-ink/40 bg-paper shadow-chip'
                    : 'border-ink/8 bg-paper/60 hover:border-ink/20 hover:bg-paper',
                )}
              >
                <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                  <div className="truncate text-sm font-semibold text-ink">{d.name}</div>
                  <span className="shrink-0 font-v4-mono text-[10px] font-bold text-ink/55 numeric">
                    {d.stage} · {d.tier ?? '—'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/8">
                    <div
                      className={cn('h-full transition-all', tone)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="shrink-0 font-v4-mono text-[10px] text-ink/65 numeric">{total}/80</span>
                </div>
              </button>
            </li>
          );
        })}
        {deals.length === 0 && (
          <li className="rounded-md border border-dashed border-ink/15 px-3.5 py-6 text-center text-xs text-ink/45">
            沒有活躍案件
          </li>
        )}
      </ol>
    </aside>
  );
}

// ============================================================
// 右側 panel — 抓 score_notes + deal_questions,組裝 ScoresClient
// ============================================================
function MeddpiccPanel({ deal, isFixtures }: { deal: Deal; isFixtures: boolean }) {
  const [notes, setNotes] = useState<ScoreNote[] | null>(null);
  const [questions, setQuestions] = useState<DealQuestion[] | null>(null);

  useEffect(() => {
    if (isFixtures) { setNotes([]); setQuestions([]); return; }
    let cancelled = false;
    setNotes(null);
    setQuestions(null);
    const supabase = createClient();
    Promise.all([
      supabase.from('score_notes').select('*').eq('deal_id', deal.id),
      supabase.from('deal_questions').select('*').eq('deal_id', deal.id),
    ]).then(([n, q]) => {
      if (cancelled) return;
      setNotes((n.data as ScoreNote[] | null) ?? []);
      setQuestions((q.data as DealQuestion[] | null) ?? []);
    });
    return () => { cancelled = true; };
  }, [deal.id, isFixtures]);

  const loading = notes === null || questions === null;

  return (
    <div className="grid content-start gap-4">
      <DealContext deal={deal} />
      {loading ? (
        <div className="grid place-items-center rounded-md border border-ink/10 bg-paper px-6 py-10 text-sm text-ink/55">
          載入 MEDDPICC…
        </div>
      ) : (
        <ScoresClient
          key={deal.id}
          dealId={deal.id}
          scores={deal.scores ?? null}
          notes={notes ?? []}
          questions={questions ?? []}
          isFixtures={isFixtures}
        />
      )}
    </div>
  );
}

function DealContext({ deal }: { deal: Deal }) {
  const stageName = STAGES.find((s) => s.id === deal.stage)?.name;
  return (
    <div className="grid gap-1 rounded-md border border-ink/10 bg-paper p-4">
      <div className="label-caps text-ink/45">當前狀態</div>
      <div className="font-v4-serif text-lg font-semibold leading-tight text-ink">{deal.name}</div>
      <div className="font-v4-mono text-[11px] text-ink/55 numeric">
        {deal.stage}{stageName ? ` · ${stageName}` : ''} · Tier {deal.tier ?? '—'}
      </div>
      {deal.next_step && (
        <div className="mt-1.5 text-xs leading-5 text-ink/65">
          <span className="font-v4-mono text-ink/50">當前下一步:</span> {deal.next_step}
        </div>
      )}
    </div>
  );
}
