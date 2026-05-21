import { ChevronRight, Database, ShieldCheck, Sliders, Users } from 'lucide-react';
import type { Snapshot } from '@/lib/v4/types';

export function SettingsView({ snapshot }: { snapshot: Snapshot }) {
  const teamCount = snapshot.teams.length;
  const memberCount = snapshot.profiles.length;

  const groups: Array<{
    title: string;
    description: string;
    items: Array<{ label: string; hint: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }>;
  }> = [
    {
      title: '組織',
      description: '團隊、成員、權限',
      items: [
        { label: '團隊管理', hint: `${teamCount} 個團隊`, icon: Users },
        { label: '成員與權限', hint: `${memberCount} 位成員 · admin / team_lead / rm`, icon: ShieldCheck },
      ],
    },
    {
      title: 'Pipeline 設定',
      description: '階段機率、紅旗閾值、Tier 規則',
      items: [
        { label: '階段機率', hint: 'L1–L7 加權預測係數', icon: Sliders },
        { label: '紅旗規則', hint: 'EB 分數 / 總分 / 久未更新天數', icon: Sliders },
        { label: 'Tier 與聯繫週期', hint: 'SSS 14 天 · S/A 30 天 · B 60 天 · C 90 天', icon: Sliders },
      ],
    },
    {
      title: '資料',
      description: '匯出、痛點商品矩陣、整合',
      items: [
        { label: '痛點 / 商品矩陣', hint: 'AI 配對 prompt 的知識來源', icon: Database },
        { label: '匯出 CSV', hint: '整份 pipeline 下載', icon: Database },
      ],
    },
  ];

  return (
    <div className="grid gap-10 px-8 py-10 lg:px-14 lg:py-14">
      <header className="grid gap-2">
        <div className="label-caps text-ink/45">Settings</div>
        <h1 className="font-v4-serif text-[44px] font-medium leading-[1.05] tracking-tight text-ink lg:text-[56px]">
          系統設定
        </h1>
        <p className="max-w-2xl text-base leading-7 text-ink/65">
          只有 admin 看得到。每一塊設定都會展開為獨立頁面，不會把所有東西塞在 modal 裡。
        </p>
      </header>

      {groups.map((g) => (
        <section key={g.title} className="grid gap-3">
          <div>
            <div className="label-caps text-ink/55">{g.title}</div>
            <h2 className="mt-1 font-v4-serif text-2xl font-medium text-ink">{g.description}</h2>
          </div>
          <ul className="grid gap-2 rounded-md border border-ink/10 bg-paper p-2">
            {g.items.map((item) => (
              <li key={item.label}>
                <button className="group grid w-full grid-cols-[36px_1fr_20px] items-center gap-3 rounded-sm px-3 py-3 text-left transition hover:bg-cream/60">
                  <span className="grid h-8 w-8 place-items-center rounded-sm border border-ink/12 bg-cream/60 text-ink">
                    <item.icon className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <div>
                    <div className="font-v4-serif text-base font-semibold text-ink">{item.label}</div>
                    <div className="mt-0.5 text-xs text-ink/55">{item.hint}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-ink/30 transition group-hover:translate-x-0.5 group-hover:text-ink" strokeWidth={1.75} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <div className="rounded-md border border-dashed border-ink/15 bg-cream/40 p-6 text-center text-sm text-ink/45">
        這只是設定中心的入口頁。實作時每個 item 點進去都會有自己的獨立頁面。
      </div>
    </div>
  );
}
