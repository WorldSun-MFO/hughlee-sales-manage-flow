'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Search } from 'lucide-react';
import type { Snapshot, StageId, Tier } from '@/lib/v4/types';
import { STAGE_PROB, STAGES } from '@/lib/v4/constants';
import { cn, fmtMoney, priorityReason, totalScore, TIER_STYLES } from '@/lib/v4/utils';

export function PipelineView({ snapshot, base }: { snapshot: Snapshot; base: '/v4/workspace' | '/v4/hub' }) {
  const [stage, setStage] = useState<StageId | ''>('');
  const [tier, setTier] = useState<Tier | ''>('');
  const [q, setQ] = useState('');

  const filteredDeals = useMemo(() => {
    const query = q.toLowerCase().trim();
    return snapshot.deals.filter((d) => {
      if (stage && d.stage !== stage) return false;
      if (tier && d.tier !== tier) return false;
      if (query && !`${d.name} ${d.product ?? ''} ${d.next_step ?? ''}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [snapshot.deals, stage, tier, q]);

  const stageCount = (s: StageId) => snapshot.deals.filter((d) => d.stage === s).length;
  const stageAum = (s: StageId) => snapshot.deals.filter((d) => d.stage === s).reduce((sum, d) => sum + Number(d.aum_usd), 0);
  const maxStageCount = Math.max(...STAGES.map((s) => stageCount(s.id)), 1);

  return (
    <div className="grid gap-10 px-8 py-10 lg:px-14 lg:py-14">
      <header className="grid gap-2">
        <div className="label-caps text-ink/45">Pipeline</div>
        <h1 className="font-v4-serif text-[44px] font-medium leading-[1.05] tracking-tight text-ink lg:text-[56px]">
          銷售漏斗
        </h1>
        <p className="max-w-2xl text-base leading-7 text-ink/65">
          按 L1–L7 階段分佈、各階段加總 AUM、可篩選的全案件清單。
        </p>
      </header>

      <section className="grid gap-3">
        <div className="label-caps text-ink/55">階段分布</div>
        <div className="grid gap-1.5 rounded-md border border-ink/10 bg-paper p-5">
          {STAGES.map((s) => {
            const count = stageCount(s.id);
            const aum = stageAum(s.id);
            const width = (count / maxStageCount) * 100;
            const active = stage === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStage((cur) => (cur === s.id ? '' : s.id))}
                className={cn(
                  'grid grid-cols-[48px_1fr_120px] items-center gap-4 rounded-sm px-2 py-1.5 text-left transition',
                  active ? 'bg-ink/5 ring-1 ring-inset ring-ink/20' : 'hover:bg-cream/60',
                )}
              >
                <span className={`stage-${s.id} grid h-7 w-12 place-items-center rounded-sm font-v4-mono text-[11px] font-bold`}>
                  {s.id}
                </span>
                <div className="grid gap-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-ink/70">{s.name}</span>
                    <span className="font-v4-mono text-[11px] text-ink/45 numeric">{STAGE_PROB[s.id]}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-ink/8">
                    <div className={`stage-${s.id} h-full transition-all`} style={{ width: `${Math.max(width, 4)}%` }} />
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-v4-mono text-sm font-semibold text-ink numeric">{count} 件</div>
                  <div className="font-v4-mono text-[11px] text-ink/55 numeric">{fmtMoney(aum)}</div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <div className="label-caps text-ink/55">All deals · {filteredDeals.length} / {snapshot.deals.length}</div>
            <h2 className="mt-1 font-v4-serif text-2xl font-medium text-ink">案件清單</h2>
          </div>
          {(stage || tier || q) ? (
            <button
              onClick={() => { setStage(''); setTier(''); setQ(''); }}
              className="font-v4-mono text-xs font-semibold text-ink/55 transition hover:text-ink"
            >
              清除篩選 ✕
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-md border border-ink/15 bg-paper px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-ink/45" strokeWidth={1.75} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜尋客戶、商品、下一步"
              className="w-56 bg-transparent text-sm text-ink outline-none placeholder:text-ink/35"
            />
          </div>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as Tier | '')}
            className="h-9 rounded-md border border-ink/15 bg-paper px-3 text-sm font-semibold text-ink outline-none"
          >
            <option value="">全部等級</option>
            {(['SSS', 'S', 'A', 'B', 'C'] as Tier[]).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <ul className="grid gap-2">
          {filteredDeals.length === 0 ? (
            <li className="rounded-md border border-ink/10 bg-cream/40 px-6 py-10 text-center text-sm font-semibold text-ink/40">
              沒有符合條件的案件
            </li>
          ) : (
            filteredDeals.map((d) => {
              const reason = priorityReason(d, snapshot.tierConfig);
              return (
                <li key={d.id}>
                  <Link
                    href={`${base}/clients/${d.id}`}
                    className="group grid grid-cols-[60px_1fr_140px_120px] items-center gap-4 rounded-md border border-ink/10 bg-paper p-4 transition hover:border-ink/25 hover:shadow-panel"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className={`stage-${d.stage} grid h-9 w-12 place-items-center rounded-sm font-v4-mono text-xs font-bold`}>
                        {d.stage}
                      </span>
                      {d.tier ? (
                        <span className={`rounded-sm px-1 py-0.5 font-v4-mono text-[9px] font-bold ${TIER_STYLES[d.tier]}`}>{d.tier}</span>
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <div className="font-v4-serif text-lg font-semibold leading-tight text-ink">
                        {d.name.replace(/^【範例】/, '')}
                      </div>
                      <div className="mt-1 flex items-center gap-2 font-v4-mono text-xs text-ink/55">
                        <span>{d.rm?.full_name ?? '—'}</span>
                        <span className="text-ink/25">·</span>
                        <span className="truncate">{d.product ?? '—'}</span>
                      </div>
                    </div>
                    <div className="text-xs">
                      {reason ? (
                        <span className="font-v4-mono font-semibold text-ink/70">{reason.icon} {reason.text}</span>
                      ) : (
                        <span className="font-v4-mono text-ink/35">健康</span>
                      )}
                      <div className="mt-1 font-v4-mono text-[11px] text-ink/45 numeric">分數 {totalScore(d)}/80</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-v4-mono text-base font-semibold text-ink numeric">{fmtMoney(Number(d.aum_usd))}</span>
                      <ArrowUpRight className="h-4 w-4 text-ink/30 transition group-hover:text-ink" strokeWidth={1.75} />
                    </div>
                  </Link>
                </li>
              );
            })
          )}
        </ul>
      </section>
    </div>
  );
}
