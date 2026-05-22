import Link from 'next/link';
import { ArrowUpRight, Brain, FileText, Globe } from 'lucide-react';
import type { MarketIntelRow } from '@/lib/v4/data';
import { daysSince } from '@/lib/v4/utils';

const STANCE_TONE: Record<MarketIntelRow['stance'], string> = {
  bullish: 'border-forest/30 bg-forest/5 text-forest',
  bearish: 'border-claret/30 bg-claret/5 text-claret',
  neutral: 'border-ink/15 bg-ink/3 text-ink/65',
  na:      'border-ink/10 bg-ink/2 text-ink/45',
};

const STANCE_LABEL: Record<MarketIntelRow['stance'], string> = {
  bullish: 'BULLISH',
  bearish: 'BEARISH',
  neutral: 'NEUTRAL',
  na:      'N/A',
};

export function MarketView({ rows }: { rows: MarketIntelRow[] }) {
  return (
    <div className="grid gap-10 px-8 py-10 lg:px-14 lg:py-14">
      <header className="grid gap-2">
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-2">
            <div className="label-caps text-ink/45">Market Intel</div>
            <h1 className="font-v4-serif text-[44px] font-medium leading-[1.05] tracking-tight text-ink lg:text-[56px]">
              市場大腦
            </h1>
          </div>
          <Link
            href="/market"
            className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm font-semibold text-ink/75 transition hover:border-ink/30 hover:text-ink"
          >
            進入完整 Market 模組 <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </div>
        <p className="max-w-2xl text-base leading-7 text-ink/65">
          最新 {rows.length} 篇情報。詳細編輯 / 配對建議審核請進入完整模組。
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="grid place-items-center gap-2 rounded-md border border-dashed border-ink/15 bg-paper/60 px-6 py-16 text-center">
          <Brain className="h-6 w-6 text-ink/30" strokeWidth={1.5} />
          <div className="text-sm text-ink/55">尚未有任何市場情報。</div>
          <Link href="/market/new" className="mt-2 inline-flex items-center gap-1.5 font-v4-mono text-xs font-semibold text-ink/70 hover:text-ink">
            新增第一篇 → <ArrowUpRight className="h-3 w-3" strokeWidth={1.75} />
          </Link>
        </div>
      ) : (
        <section className="grid gap-3">
          <div className="label-caps text-ink/55">最新情報 · {rows.length} 篇</div>
          <ul className="grid gap-3">
            {rows.map((i) => (
              <li key={i.id}>
                <Link
                  href={`/market/${i.id}`}
                  className="group grid grid-cols-[100px_1fr_auto] items-start gap-4 rounded-md border border-ink/10 bg-paper p-5 transition hover:border-ink/25 hover:shadow-panel"
                >
                  <div className="grid gap-1.5">
                    <span className={`inline-flex items-center justify-center rounded-sm border px-2 py-0.5 font-v4-mono text-[10px] font-bold ${STANCE_TONE[i.stance]}`}>
                      {STANCE_LABEL[i.stance]}
                    </span>
                    <span className="inline-flex items-center gap-1 font-v4-mono text-[11px] text-ink/55">
                      <Globe className="h-3 w-3" strokeWidth={2} /> {i.region}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-v4-serif text-lg font-semibold leading-tight text-ink">{i.title}</h3>
                    {i.summary && (
                      <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-ink/65">{i.summary}</p>
                    )}
                    <div className="mt-2 flex items-center gap-2 font-v4-mono text-[11px] text-ink/45">
                      {i.source_type && (
                        <>
                          <FileText className="h-3 w-3" strokeWidth={2} />
                          <span>{i.source_type}</span>
                          <span className="text-ink/25">·</span>
                        </>
                      )}
                      <span className="numeric">{daysSince(i.published_at ?? i.created_at)} 天前</span>
                    </div>
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-ink/30 transition group-hover:text-ink" strokeWidth={1.75} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
