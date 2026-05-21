import Link from 'next/link';
import { ArrowUpRight, LayoutDashboard, LayoutGrid } from 'lucide-react';
import { getSnapshot } from '@/lib/v4/data';
import { fmtMoney } from '@/lib/v4/utils';

export const dynamic = 'force-dynamic';

export default async function ChooserPage() {
  const snap = await getSnapshot();
  const totalAum = snap.deals.reduce((sum, d) => sum + Number(d.aum_usd), 0);

  const layouts: Array<{
    href: string;
    eyebrow: string;
    title: string;
    tagline: string;
    description: string;
    attrs: Array<[string, string]>;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    accent: string;
  }> = [
    {
      href: '/v4/workspace',
      eyebrow: 'Layout C',
      title: 'Workspace',
      tagline: 'Notion / Linear — 持久左側 nav',
      description: '一個介面只做一件事。左側 nav 永遠在，主內容區單純呈現該功能。切換功能像切 tab。',
      attrs: [
        ['原則', '一畫面一內容；功能用 nav 切換'],
        ['情境', '坐在電腦前、長時間連續使用'],
        ['代價', '小螢幕 nav 會卡空間'],
      ],
      icon: LayoutDashboard,
      accent: 'from-forest to-ink',
    },
    {
      href: '/v4/hub',
      eyebrow: 'Layout D',
      title: 'Hub',
      tagline: 'iPad / Apple Watch — 卡片式 hub-and-spoke',
      description: '主畫面六張大卡，點哪張進哪個全螢幕功能，左上「回 Hub」。每個區塊獨立呼吸。',
      attrs: [
        ['原則', '一畫面一內容；回 Hub 切換'],
        ['情境', '臨時用、行動端、心智上想「回家」'],
        ['代價', '常用功能多一步點擊'],
      ],
      icon: LayoutGrid,
      accent: 'from-cobalt to-ink',
    },
  ];

  return (
    <main className="min-h-screen bg-cream">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ink/35 to-transparent" />

      <div className="mx-auto max-w-[1240px] px-6 pt-14 pb-16 lg:px-10">
        <header className="grid gap-3 pb-12 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="label-caps text-ink/55">WorldSun · V4 Layout Studies</div>
            <h1 className="mt-3 font-v4-serif text-[56px] leading-[0.95] font-medium tracking-tight text-ink lg:text-[80px]">
              Two ways to <span className="italic text-forest">read</span><br />the pipeline.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-ink/65">
              共同原則：一個介面只展現一個內容，其他功能用按鈕切換。差別只在「怎麼切」——持久 nav 還是回 Hub。
            </p>
          </div>
          <div className="grid gap-1 text-right">
            <div className="label-caps text-ink/45">Snapshot</div>
            <div className="font-v4-mono text-2xl font-semibold numeric text-ink">{fmtMoney(totalAum)}</div>
            <div className="font-v4-mono text-xs font-semibold text-ink/55 numeric">{snap.deals.length} deals · {snap.source}</div>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-2">
          {layouts.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="group relative overflow-hidden rounded-md border border-ink/12 bg-paper p-8 transition hover:-translate-y-0.5 hover:border-ink/25 hover:shadow-panel"
            >
              <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${l.accent}`} />
              <div className="flex items-start justify-between">
                <div>
                  <div className="label-caps text-ink/50">{l.eyebrow}</div>
                  <h2 className="mt-2 font-v4-serif text-4xl font-semibold leading-tight text-ink">{l.title}</h2>
                  <div className="mt-1 font-v4-mono text-xs text-ink/55">{l.tagline}</div>
                </div>
                <l.icon className="h-6 w-6 text-ink/35" strokeWidth={1.5} />
              </div>

              <p className="mt-6 text-sm leading-6 text-ink/75">{l.description}</p>

              <dl className="mt-6 grid gap-2 text-xs">
                {l.attrs.map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[60px_1fr] gap-3 leading-5">
                    <dt className="label-caps text-ink/45">{k}</dt>
                    <dd className="text-ink/80">{v}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-8 flex items-center gap-1.5 font-v4-mono text-xs font-semibold text-ink transition group-hover:gap-3">
                進入此版型 <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} />
              </div>
            </Link>
          ))}
        </div>

        <footer className="mt-14 grid gap-2 border-t border-ink/10 pt-6 text-xs text-ink/50">
          <div className="font-v4-mono numeric">
            data source: <span className="font-semibold text-ink/70">{snap.source}</span>
            {snap.source === 'fixtures' ? '（未設 SUPABASE env，正在跑假資料）' : '（已接 Supabase）'}
          </div>
          <div>兩個版型共用同一份 data adapter 與 6 個 view 元件，比較的是純粹的「導覽哲學」。</div>
        </footer>
      </div>
    </main>
  );
}
