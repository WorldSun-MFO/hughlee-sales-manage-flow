import Link from 'next/link';
import { ArrowUpRight, Flag, Phone, Sparkles, TrendingUp } from 'lucide-react';
import type { Snapshot, StageId } from '@/lib/v4/types';
import { contactOverdue, fmtMoney, redFlag } from '@/lib/v4/utils';

export function OverviewView({ snapshot, base }: { snapshot: Snapshot; base: '/workspace' | '/hub' }) {
  const deals = snapshot.deals;
  const activeDeals = deals.filter((d) => d.stage !== 'L7');
  const totalAum = activeDeals.reduce((s, d) => s + Number(d.aum_usd), 0);

  const probMap: Record<StageId, number> = { L1: 7, L2: 13, L3: 20, L4: 44, L5: 68, L6: 90, L7: 100 };
  const weighted = activeDeals.reduce((s, d) => s + Number(d.aum_usd) * (probMap[d.stage] / 100), 0);
  const l4Plus = activeDeals.filter((d) => ['L4', 'L5', 'L6'].includes(d.stage));
  const l4PlusPct = activeDeals.length ? Math.round((l4Plus.length / activeDeals.length) * 100) : 0;
  const overdue = activeDeals.filter((d) => contactOverdue(d, snapshot.tierConfig)?.status === 'overdue');
  const flagged = activeDeals.filter((d) => redFlag(d));

  return (
    <div className="grid gap-8 px-4 py-6 sm:gap-12 sm:px-8 sm:py-10 lg:px-14 lg:py-14">
      <header className="grid gap-2">
        <div className="label-caps text-ink/45">Overview</div>
        <h1 className="font-v4-serif text-[32px] font-medium leading-[1.05] tracking-tight text-ink sm:text-[44px] lg:text-[56px]">
          整體 Pipeline 狀況
        </h1>
      </header>

      <section className="grid gap-6">
        <div className="grid gap-1 border-l-2 border-forest pl-4 sm:pl-6">
          <div className="label-caps text-ink/55">Pipeline 總 AUM · {activeDeals.length} 個活躍案件</div>
          <div className="font-v4-mono text-[52px] font-medium leading-none tracking-tight text-ink numeric sm:text-[80px] lg:text-[120px]">
            {fmtMoney(totalAum)}
          </div>
          <div className="mt-2 max-w-md text-sm leading-6 text-ink/55">
            不含 L7（已成交）的所有在跑案件加總。實際成交金額視階段機率加權。
          </div>
        </div>
      </section>

      <section className="grid gap-3">
        <div className="label-caps text-ink/55">分項指標</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile
            href={`${base}/pipeline`}
            icon={TrendingUp}
            label="加權預測"
            value={fmtMoney(weighted)}
            hint="依階段機率加權"
            tone="cobalt"
          />
          <Tile
            href={`${base}/pipeline?stage=L4`}
            icon={Sparkles}
            label="L4+ 高品質"
            value={`${l4Plus.length} 件`}
            hint={`佔比 ${l4PlusPct}% · 健康 ≥ 25%`}
            tone="forest"
          />
          <Tile
            href={`${base}/today`}
            icon={Phone}
            label="需聯繫"
            value={`${overdue.length} 件`}
            hint="超過 Tier 建議週期"
            tone={overdue.length > 0 ? 'brass' : 'neutral'}
          />
          <Tile
            href={`${base}/today`}
            icon={Flag}
            label="紅旗"
            value={`${flagged.length} 件`}
            hint="EB 未確認 / 分低 / 久未更新"
            tone={flagged.length > 0 ? 'claret' : 'neutral'}
          />
        </div>
      </section>
    </div>
  );
}

function Tile({
  href, icon: Icon, label, value, hint, tone,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  hint: string;
  tone: 'cobalt' | 'forest' | 'brass' | 'claret' | 'neutral';
}) {
  const toneText = tone === 'cobalt' ? 'text-cobalt'
    : tone === 'forest' ? 'text-forest'
      : tone === 'brass' ? 'text-brass'
        : tone === 'claret' ? 'text-claret'
          : 'text-ink/70';

  return (
    <Link
      href={href}
      className="group grid gap-3 rounded-md border border-ink/10 bg-paper p-5 transition hover:-translate-y-0.5 hover:border-ink/25 hover:shadow-panel"
    >
      <div className="flex items-center justify-between">
        <Icon className={`h-4 w-4 ${toneText}`} strokeWidth={1.75} />
        <ArrowUpRight className="h-3.5 w-3.5 text-ink/30 transition group-hover:text-ink" strokeWidth={1.75} />
      </div>
      <div>
        <div className="label-caps text-ink/55">{label}</div>
        <div className={`mt-1 font-v4-mono text-3xl font-semibold numeric ${toneText}`}>{value}</div>
        <div className="mt-1 text-xs text-ink/50">{hint}</div>
      </div>
    </Link>
  );
}
