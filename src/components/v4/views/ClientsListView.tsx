import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { Snapshot } from '@/lib/v4/types';
import { fmtMoney, totalScore, TIER_STYLES } from '@/lib/v4/utils';
import { AddDealButton } from '@/components/v4/AddDealButton';

export function ClientsListView({ snapshot, base }: { snapshot: Snapshot; base: '/v4/workspace' | '/v4/hub' }) {
  const isFixtures = snapshot.source === 'fixtures';
  const grouped = new Map<string, typeof snapshot.deals>();
  for (const tier of ['SSS', 'S', 'A', 'B', 'C'] as const) {
    grouped.set(tier, snapshot.deals.filter((d) => d.tier === tier));
  }

  return (
    <div className="grid gap-10 px-8 py-10 lg:px-14 lg:py-14">
      <header className="grid gap-2">
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-2">
            <div className="label-caps text-ink/45">Clients</div>
            <h1 className="font-v4-serif text-[44px] font-medium leading-[1.05] tracking-tight text-ink lg:text-[56px]">
              客戶名冊
            </h1>
          </div>
          <div className="pt-2">
            <AddDealButton base={base} isFixtures={isFixtures} />
          </div>
        </div>
        <p className="max-w-2xl text-base leading-7 text-ink/65">
          以等級分組。每位客戶獨立頁面承載 MEDDIC 評分、對話紀錄、AI 路徑、任務。
        </p>
      </header>

      {(['SSS', 'S', 'A', 'B', 'C'] as const).map((tier) => {
        const deals = grouped.get(tier) ?? [];
        if (deals.length === 0) return null;
        const tierAum = deals.reduce((s, d) => s + Number(d.aum_usd), 0);
        const tierConfig = snapshot.tierConfig.find((t) => t.key === tier);
        return (
          <section key={tier} className="grid gap-4">
            <div className="flex items-baseline justify-between gap-3 border-b border-ink/10 pb-2">
              <div className="flex items-center gap-3">
                <span className={`rounded-sm px-2 py-1 font-v4-mono text-xs font-bold ${TIER_STYLES[tier]}`}>{tier}</span>
                <span className="font-v4-serif text-xl font-medium text-ink">{tierConfig?.name ?? tier}</span>
                <span className="font-v4-mono text-xs text-ink/45 numeric">{deals.length} 位 · {fmtMoney(tierAum)}</span>
              </div>
              <div className="font-v4-mono text-[11px] text-ink/45">建議聯繫週期 {tierConfig?.contact_days ?? '—'} 天</div>
            </div>
            <ul className="grid gap-2">
              {deals.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`${base}/clients/${d.id}`}
                    className="group grid grid-cols-[60px_1fr_120px_120px] items-center gap-4 rounded-md border border-ink/10 bg-paper p-4 transition hover:border-ink/25 hover:shadow-panel"
                  >
                    <span className={`stage-${d.stage} grid h-9 place-items-center rounded-sm font-v4-mono text-xs font-bold`}>
                      {d.stage}
                    </span>
                    <div className="min-w-0">
                      <div className="font-v4-serif text-lg font-semibold leading-tight text-ink">
                        {d.name.replace(/^【範例】/, '')}
                      </div>
                      <div className="mt-1 truncate font-v4-mono text-xs text-ink/55">
                        {d.rm?.full_name ?? '—'} · {d.product ?? '—'}
                      </div>
                    </div>
                    <div className="text-xs text-ink/55">
                      <span className="font-v4-mono numeric">{totalScore(d)}/80</span>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-ink/8">
                        <div className="h-full bg-forest" style={{ width: `${(totalScore(d) / 80) * 100}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-v4-mono text-base font-semibold text-ink numeric">{fmtMoney(Number(d.aum_usd))}</span>
                      <ArrowUpRight className="h-4 w-4 text-ink/30 transition group-hover:text-ink" strokeWidth={1.75} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
