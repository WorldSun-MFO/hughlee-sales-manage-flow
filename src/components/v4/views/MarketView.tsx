import { Brain, FileText, Globe } from 'lucide-react';

const mockIntel = [
  {
    id: 'intel-1', region: 'HK', stance: 'bullish',
    title: '香港分紅保險新一輪預定利率上調 ',
    summary: '頭部三家保險公司於本月初同步上調分紅保單預定利率，市場預期高 AUM 客戶將加速配置決策。',
    source: 'PB Desk Note', daysAgo: 2,
  },
  {
    id: 'intel-2', region: 'US', stance: 'neutral',
    title: '美元利率維持高檔，收益型產品仍需做壓力測試',
    summary: '高利率環境延續至 Q3。對保費融資結構建議重新跑情境分析，特別是 IRR 與 break-even 點。',
    source: 'Market Intel', daysAgo: 4,
  },
  {
    id: 'intel-3', region: 'TW', stance: 'bearish',
    title: '台灣 CFC 制度上路後高資產客戶申報節奏明顯延後',
    summary: '一季數據顯示申報窗口前 90 天詢問量激增 38%，建議提早整理客戶資金動線。',
    source: 'Tax Note', daysAgo: 6,
  },
];

const stanceTone: Record<string, string> = {
  bullish: 'border-forest/30 bg-forest/5 text-forest',
  bearish: 'border-claret/30 bg-claret/5 text-claret',
  neutral: 'border-ink/15 bg-ink/3 text-ink/65',
};

export function MarketView() {
  return (
    <div className="grid gap-10 px-8 py-10 lg:px-14 lg:py-14">
      <header className="grid gap-2">
        <div className="label-caps text-ink/45">Market Intel</div>
        <h1 className="font-v4-serif text-[44px] font-medium leading-[1.05] tracking-tight text-ink lg:text-[56px]">
          市場大腦
        </h1>
        <p className="max-w-2xl text-base leading-7 text-ink/65">
          市場情報、AI 摘要、客戶配對建議。情報歸情報，客戶歸客戶，兩邊在這裡相認。
        </p>
      </header>

      <section className="grid gap-3">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="label-caps text-ink/55">最新情報 · {mockIntel.length} 篇</div>
            <h2 className="mt-1 font-v4-serif text-2xl font-medium text-ink">本週情報</h2>
          </div>
        </div>
        <ul className="grid gap-3">
          {mockIntel.map((i) => (
            <li key={i.id} className="grid grid-cols-[100px_1fr_auto] items-start gap-4 rounded-md border border-ink/10 bg-paper p-5">
              <div className="grid gap-1.5">
                <span className={`inline-flex items-center justify-center rounded-sm border px-2 py-0.5 font-v4-mono text-[10px] font-bold ${stanceTone[i.stance]}`}>
                  {i.stance.toUpperCase()}
                </span>
                <span className="inline-flex items-center gap-1 font-v4-mono text-[11px] text-ink/55">
                  <Globe className="h-3 w-3" strokeWidth={2} /> {i.region}
                </span>
              </div>
              <div>
                <h3 className="font-v4-serif text-lg font-semibold leading-tight text-ink">{i.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-ink/65">{i.summary}</p>
                <div className="mt-2 flex items-center gap-2 font-v4-mono text-[11px] text-ink/45">
                  <FileText className="h-3 w-3" strokeWidth={2} />
                  <span>{i.source}</span>
                  <span className="text-ink/25">·</span>
                  <span className="numeric">{i.daysAgo} 天前</span>
                </div>
              </div>
              <button className="inline-flex h-9 items-center gap-1.5 rounded-md border border-cobalt/30 bg-cobalt/5 px-3 text-xs font-semibold text-cobalt hover:bg-cobalt/10">
                <Brain className="h-3.5 w-3.5" strokeWidth={1.75} /> 配對客戶
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="rounded-md border border-dashed border-ink/15 bg-cream/40 p-6 text-center text-sm text-ink/45">
        這只是一個畫面示範。實際接 Supabase 後會帶出真實情報與配對建議。
      </div>
    </div>
  );
}
