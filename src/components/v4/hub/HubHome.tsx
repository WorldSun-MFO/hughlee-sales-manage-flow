import Link from 'next/link';
import { ArrowUpRight, Briefcase, ClipboardList, Flag, Gauge, Home, LayoutGrid, MessageSquareText, Phone, Route, Settings, Sparkles, TrendingUp, Users } from 'lucide-react';
import type { Snapshot, StageId } from '@/lib/v4/types';
import { contactOverdue, fmtMoney, redFlag, urgencyScore } from '@/lib/v4/utils';

export function HubHome({ snapshot }: { snapshot: Snapshot }) {
  const deals = snapshot.deals;
  const activeDeals = deals.filter((d) => d.stage !== 'L7');
  const totalAum = activeDeals.reduce((s, d) => s + Number(d.aum_usd), 0);
  const probMap: Record<StageId, number> = { L1: 7, L2: 13, L3: 20, L4: 44, L5: 68, L6: 90, L7: 100 };
  const weighted = activeDeals.reduce((s, d) => s + Number(d.aum_usd) * (probMap[d.stage] / 100), 0);

  const priorityCount = activeDeals.filter((d) => urgencyScore(d, snapshot.tierConfig) > 0).length;
  const overdueCount = activeDeals.filter((d) => contactOverdue(d, snapshot.tierConfig)?.status === 'overdue').length;
  const flaggedCount = activeDeals.filter((d) => redFlag(d)).length;
  const taskCount = snapshot.tasks.filter((t) => t.status !== 'done').length;

  const today = new Date().toLocaleDateString('zh-Hant-TW', { month: 'long', day: 'numeric', weekday: 'long' });

  const cards: Array<{
    href: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    label: string;
    primary: string;
    secondary: string;
    accent: string;
  }> = [
      {
        href: '/hub/overview',
        icon: Gauge,
        label: '總覽',
        primary: fmtMoney(totalAum),
        secondary: `${activeDeals.length} 個活躍案件 · 加權 ${fmtMoney(weighted)}`,
        accent: 'border-l-ink/30',
      },
      {
        href: '/hub/today',
        icon: Home,
        label: '今日要做',
        primary: `${priorityCount + taskCount}`,
        secondary: `${priorityCount} 個優先客戶 · ${taskCount} 個任務`,
        accent: priorityCount > 0 ? 'border-l-brass' : 'border-l-ink/15',
      },
      {
        href: '/hub/tasks',
        icon: ClipboardList,
        label: '我的任務',
        primary: `${taskCount}`,
        secondary: '依指派人分組 · 新增 / 勾選 / 指派',
        accent: taskCount > 0 ? 'border-l-cobalt/50' : 'border-l-ink/15',
      },
      {
        href: '/hub/pipeline',
        icon: LayoutGrid,
        label: 'Pipeline',
        primary: `${deals.length} 件`,
        secondary: `L1–L7 階段分布 · 紅旗 ${flaggedCount} · 逾期 ${overdueCount}`,
        accent: 'border-l-cobalt/50',
      },
      {
        href: '/hub/clients',
        icon: Users,
        label: '客戶名冊',
        primary: `${deals.length} 位`,
        secondary: '按 Tier 分組 · 單頁深入',
        accent: 'border-l-forest',
      },
      {
        href: '/hub/ai',
        icon: MessageSquareText,
        label: 'AI 助手',
        primary: '問什麼',
        secondary: '優先順序 · 跟進信件 · 卡關分析',
        accent: 'border-l-cobalt/50',
      },
      {
        href: '/hub/plan',
        icon: Route,
        label: '成交規劃',
        primary: '生成路徑',
        secondary: '挑案件 · 自動產出 MEDDIC 步驟',
        accent: 'border-l-brass/60',
      },
      {
        href: '/hub/market',
        icon: Briefcase,
        label: '市場大腦',
        primary: '3 篇',
        secondary: '本週情報 · AI 配對建議',
        accent: 'border-l-ink/15',
      },
      {
        href: '/hub/settings',
        icon: Settings,
        label: '設定',
        primary: `${snapshot.profiles.length} 人 · ${snapshot.teams.length} 隊`,
        secondary: 'admin 專屬',
        accent: 'border-l-ink/15',
      },
    ];

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6 sm:py-12 lg:px-10 lg:py-16">
      <header className="grid gap-3 pb-8 sm:pb-12">
        <div className="label-caps text-ink/45">Hub · {today}</div>
        <h1 className="font-v4-serif text-[40px] font-medium leading-[0.95] tracking-tight text-ink sm:text-[56px] lg:text-[88px]">
          <span className="italic text-forest">從哪裡開始？</span>
        </h1>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className={`group grid gap-3 rounded-md border border-ink/10 border-l-4 bg-paper p-5 transition hover:-translate-y-0.5 hover:border-ink/25 hover:shadow-panel sm:p-6 ${c.accent}`}
          >
            <div className="flex items-center justify-between">
              <c.icon className="h-5 w-5 text-ink/55" strokeWidth={1.5} />
              <ArrowUpRight className="h-4 w-4 text-ink/30 transition group-hover:text-ink" strokeWidth={1.75} />
            </div>
            <div>
              <div className="label-caps text-ink/55">{c.label}</div>
              <div className="mt-1 font-v4-serif text-3xl font-semibold leading-tight text-ink numeric sm:text-4xl">{c.primary}</div>
              <div className="mt-2 text-xs text-ink/55 numeric">{c.secondary}</div>
            </div>
          </Link>
        ))}
      </section>

      <footer className="mt-14 grid gap-2 border-t border-ink/10 pt-6 text-xs text-ink/50">
        <div className="flex flex-wrap items-center gap-3 font-v4-mono">
          {flaggedCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-claret">
              <Flag className="h-3 w-3" strokeWidth={2} /> 今天有 {flaggedCount} 個紅旗
            </span>
          ) : null}
          {overdueCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-brass">
              <Phone className="h-3 w-3" strokeWidth={2} /> {overdueCount} 個客戶逾期未聯繫
            </span>
          ) : null}
          {flaggedCount === 0 && overdueCount === 0 ? (
            <span className="inline-flex items-center gap-1 text-forest">
              <TrendingUp className="h-3 w-3" strokeWidth={2} /> Pipeline 全部健康
            </span>
          ) : null}
        </div>
      </footer>
    </div>
  );
}
