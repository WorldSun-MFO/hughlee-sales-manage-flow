'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  BrainCircuit,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  ClipboardList,
  Compass,
  FileText,
  Gauge,
  LayoutDashboard,
  LineChart,
  ListChecks,
  LockKeyhole,
  MessageSquareText,
  Milestone,
  Network,
  Paperclip,
  Plus,
  Route,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  TimerReset,
  TrendingUp,
  UserCheck,
  Users,
  Workflow,
  X,
} from 'lucide-react';
import {
  MEDDIC,
  STAGES,
  contactOverdue,
  daysSince,
  fmtMoney,
  priorityReason,
  redFlag,
  splitNextStepIntoTasks,
  stageIdx,
  totalScore,
  urgencyScore,
  type Deal,
  type MarketIntel,
  type PainPoint,
  type Profile,
  type Settings,
  type StageId,
  type Task,
  type Team,
} from './model';

type ViewKey = 'cockpit' | 'desk' | 'tasks' | 'war-room' | 'signals';
type ActionTone = 'emerald' | 'sky' | 'violet' | 'amber' | 'rose';
type TaskStatusFilter = Task['status'] | 'all';
type TaskGroupKey = 'assignee' | 'deal' | 'due';

interface Props {
  initialDeals: Deal[];
  profile: Profile;
  allProfiles: Profile[];
  painPoints: PainPoint[];
  teams: Team[];
  tasks: Task[];
  marketIntel: MarketIntel[];
  settings: Settings;
}

const VIEW_ITEMS: Array<{ key: ViewKey; label: string; icon: typeof LayoutDashboard }> = [
  { key: 'cockpit', label: 'Executive Cockpit', icon: LayoutDashboard },
  { key: 'desk', label: 'RM Daily Desk', icon: ListChecks },
  { key: 'tasks', label: 'Task Management', icon: ClipboardList },
  { key: 'war-room', label: 'Deal War Room', icon: Target },
  { key: 'signals', label: 'Market Signals', icon: BrainCircuit },
];

const STANCE_LABEL: Record<string, string> = {
  bullish: 'Bullish',
  bearish: 'Bearish',
  neutral: 'Neutral',
  na: 'N/A',
};

function dueDays(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '未設定';
  return dateStr.replaceAll('-', '/');
}

function taskStatusLabel(status: Task['status']): string {
  if (status === 'done') return '完成';
  if (status === 'doing') return '進行中';
  return '待辦';
}

function taskStatusClass(status: Task['status']): string {
  if (status === 'done') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'doing') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  return 'bg-zinc-100 text-zinc-700 border-zinc-200';
}

function taskPriorityLabel(priority: Task['priority']): string {
  if (priority === 'high') return '高';
  if (priority === 'low') return '低';
  return '中';
}

function taskPriorityClass(priority: Task['priority']): string {
  if (priority === 'high') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (priority === 'low') return 'bg-zinc-100 text-zinc-500 border-zinc-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

function taskDueLabel(days: number | null, status: Task['status']): string {
  if (status === 'done') return '已完成';
  if (days === null) return '未排期';
  if (days < 0) return `逾期 ${Math.abs(days)} 天`;
  if (days === 0) return '今天到期';
  return `${days} 天後`;
}

function taskDueClass(days: number | null, status: Task['status']): string {
  if (status === 'done') return 'bg-emerald-50 text-emerald-700';
  if (days === null) return 'bg-zinc-100 text-zinc-500';
  if (days < 0) return 'bg-rose-50 text-rose-700';
  if (days <= 3) return 'bg-amber-50 text-amber-700';
  return 'bg-sky-50 text-sky-700';
}

function scoreTone(score: number): string {
  if (score >= 64) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (score >= 48) return 'text-sky-700 bg-sky-50 border-sky-200';
  if (score >= 32) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-rose-700 bg-rose-50 border-rose-200';
}

function stageTone(stage: StageId): string {
  const map: Record<StageId, string> = {
    L1: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    L2: 'bg-stone-100 text-stone-700 border-stone-200',
    L3: 'bg-sky-50 text-sky-800 border-sky-200',
    L4: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    L5: 'bg-violet-50 text-violet-800 border-violet-200',
    L6: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    L7: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  };
  return map[stage];
}

function tierTone(tier: string | null): string {
  const map: Record<string, string> = {
    SSS: 'bg-violet-700 text-white border-violet-700',
    S: 'bg-indigo-700 text-white border-indigo-700',
    A: 'bg-sky-600 text-white border-sky-600',
    B: 'bg-teal-600 text-white border-teal-600',
    C: 'bg-stone-700 text-white border-stone-700',
  };
  return map[tier ?? ''] ?? 'bg-zinc-100 text-zinc-500 border-zinc-200';
}

function roleLabel(profile: Profile, teams: Team[]): string {
  const team = teams.find(t => t.id === profile.team_id)?.name ?? '未分團隊';
  if (profile.rm_code === 'COO') return 'COO · 全公司任務視角';
  if (profile.role === 'admin') return 'Admin · 全公司視角';
  if (profile.role === 'team_lead') return `Team Lead · ${team}`;
  return `RM · ${team}`;
}

function ownerName(deal: Deal): string {
  return deal.rm?.full_name ?? deal.rm?.email ?? '未指派';
}

function getWeakestScores(deal: Deal) {
  const scores = deal.scores ?? { m: 0, e: 0, d1: 0, d2: 0, p: 0, i: 0, c1: 0, c2: 0 };
  return MEDDIC
    .map(item => ({ ...item, score: scores[item.key] ?? 0 }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
}

function scoreStatus(score: number): 'done' | 'working' | 'risk' {
  if (score >= 7) return 'done';
  if (score >= 4) return 'working';
  return 'risk';
}

function statusLabel(status: 'done' | 'working' | 'risk'): string {
  if (status === 'done') return 'Ready';
  if (status === 'working') return 'In progress';
  return 'Needs proof';
}

function statusClass(status: 'done' | 'working' | 'risk'): string {
  if (status === 'done') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'working') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-rose-200 bg-rose-50 text-rose-700';
}

function actionToneClass(tone: ActionTone): string {
  const map: Record<ActionTone, string> = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    sky: 'border-sky-200 bg-sky-50 text-sky-800',
    violet: 'border-violet-200 bg-violet-50 text-violet-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    rose: 'border-rose-200 bg-rose-50 text-rose-800',
  };
  return map[tone];
}

function actionDotClass(tone: ActionTone): string {
  const map: Record<ActionTone, string> = {
    emerald: 'bg-emerald-500',
    sky: 'bg-sky-500',
    violet: 'bg-violet-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
  };
  return map[tone];
}

function nextBestAction(deal: Deal, settings: Settings, tiers: Settings['tier_config']['tiers']) {
  const flag = redFlag(deal, settings);
  if (flag) {
    return {
      title: 'Repair qualification evidence',
      detail: flag === 'EB 未確認' ? '把真正拍板者拉進下一次會議，否則不要讓案件往 L4/L5 假前進。' : flag,
      tone: 'rose' as ActionTone,
      icon: AlertTriangle,
    };
  }

  const paperScore = deal.scores?.p ?? 0;
  if (['L5', 'L6'].includes(deal.stage) && paperScore < 6) {
    return {
      title: 'Lock the paper process',
      detail: '把 KYC、資金來源、公司戶文件、核保資料拆成日期與負責人。',
      tone: 'amber' as ActionTone,
      icon: LockKeyhole,
    };
  }

  const contact = contactOverdue(deal, tiers);
  if (contact?.status === 'overdue') {
    return {
      title: 'Restore relationship rhythm',
      detail: `${deal.tier ?? '未分級'} 客戶已逾期 ${contact.deltaDays} 天，先補一次高品質聯繫。`,
      tone: 'amber' as ActionTone,
      icon: Bell,
    };
  }

  const weak = getWeakestScores(deal)[0];
  if (weak && weak.score < 5) {
    return {
      title: `Close ${weak.label.split('—')[0].trim()} gap`,
      detail: weak.hint,
      tone: 'sky' as ActionTone,
      icon: Target,
    };
  }

  const openStep = deal.plan?.steps.find(step => !step.completed);
  if (openStep) {
    return {
      title: openStep.title,
      detail: `${openStep.target_date} · ${openStep.stage_transition}`,
      tone: 'violet' as ActionTone,
      icon: Route,
    };
  }

  return {
    title: 'Advance the next stage',
    detail: 'Scorecard looks usable; convert the next concrete motion into a task.',
    tone: 'emerald' as ActionTone,
    icon: CheckCircle2,
  };
}

function getTeamPerformance(deals: Deal[], profiles: Profile[]) {
  return profiles
    .map(profile => {
      const owned = deals.filter(deal => deal.rm_id === profile.id);
      const aum = owned.reduce((sum, deal) => sum + Number(deal.aum_usd ?? 0), 0);
      const l4Plus = owned.filter(deal => ['L4', 'L5', 'L6', 'L7'].includes(deal.stage)).length;
      const avgScore = owned.length ? Math.round(owned.reduce((sum, deal) => sum + totalScore(deal), 0) / owned.length) : 0;
      return { profile, owned, aum, l4Plus, avgScore };
    })
    .filter(row => row.owned.length > 0)
    .sort((a, b) => b.aum - a.aum);
}

function getPaperItems(deal: Deal) {
  const p = deal.scores?.p ?? 0;
  const d2 = deal.scores?.d2 ?? 0;
  const e = deal.scores?.e ?? 0;
  const c1 = deal.scores?.c1 ?? 0;
  return [
    { label: 'KYC / source of funds', detail: '資金來源、稅務身份、PEP / CRS 風險', status: scoreStatus(p) },
    { label: 'Decision path', detail: '誰看、誰簽、誰能否決、預估多久', status: scoreStatus(d2) },
    { label: 'Economic buyer proof', detail: '拍板者是否已見過提案摘要', status: scoreStatus(e) },
    { label: 'Champion support', detail: '內部支持者是否願意推進會議與文件', status: scoreStatus(c1) },
  ];
}

function linkedIntelForDeal(deal: Deal, marketIntel: MarketIntel[]) {
  return marketIntel.filter(intel => (intel.deal_links ?? []).some(link => link.deal_id === deal.id)).slice(0, 3);
}

export function V2Workspace({
  initialDeals,
  profile,
  allProfiles,
  painPoints,
  teams,
  tasks,
  marketIntel,
  settings,
}: Props) {
  const [view, setView] = useState<ViewKey>('cockpit');
  const [query, setQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<StageId | ''>('');
  const [selectedDealId, setSelectedDealId] = useState<string | null>(initialDeals[0]?.id ?? null);
  const tierCfg = settings.tier_config?.tiers ?? [];

  const deals = initialDeals;
  const activeDeals = useMemo(() => deals.filter(d => d.stage !== 'L7'), [deals]);
  const redFlagDeals = useMemo(() => deals.filter(d => redFlag(d, settings)), [deals, settings]);
  const overdueDeals = useMemo(
    () => deals.filter(d => d.stage !== 'L7' && contactOverdue(d, tierCfg)?.status === 'overdue'),
    [deals, tierCfg]
  );
  const paperRiskDeals = useMemo(
    () => deals.filter(d => ['L5', 'L6'].includes(d.stage) && (d.scores?.p ?? 0) < 6),
    [deals]
  );
  const priorityDeals = useMemo(() => {
    return deals
      .map(deal => ({ deal, score: urgencyScore(deal, settings, tierCfg) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map(item => item.deal);
  }, [deals, settings, tierCfg]);

  const selectedDeal = useMemo(() => {
    return deals.find(d => d.id === selectedDealId) ?? priorityDeals[0] ?? deals[0] ?? null;
  }, [deals, priorityDeals, selectedDealId]);

  const filteredDeals = useMemo(() => {
    const q = query.trim().toLowerCase();
    return deals.filter(deal => {
      if (stageFilter && deal.stage !== stageFilter) return false;
      if (!q) return true;
      const hay = `${deal.name} ${deal.product ?? ''} ${deal.next_step ?? ''} ${ownerName(deal)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [deals, query, stageFilter]);

  const totalAum = activeDeals.reduce((sum, deal) => sum + Number(deal.aum_usd ?? 0), 0);
  const weightedForecast = deals.reduce(
    (sum, deal) => sum + Number(deal.aum_usd ?? 0) * ((settings.stage_probs[deal.stage] ?? 0) / 100),
    0
  );
  const l4Plus = deals.filter(d => ['L4', 'L5', 'L6', 'L7'].includes(d.stage));
  const l4PlusPct = deals.length ? Math.round((l4Plus.length / deals.length) * 100) : 0;
  const recentlyMoved = deals.filter(d => daysSince(d.last_updated) <= 7).length;
  const openTasks = tasks.filter(t => t.status !== 'done');
  const overdueTasks = openTasks.filter(t => {
    const days = dueDays(t.due_date);
    return days !== null && days < 0;
  });
  const teamPerformance = useMemo(() => getTeamPerformance(deals, allProfiles), [deals, allProfiles]);

  const maxStageCount = Math.max(1, ...STAGES.map(stage => deals.filter(d => d.stage === stage.id).length));
  const selectedWeakScores = selectedDeal ? getWeakestScores(selectedDeal) : [];
  const selectedNextSteps = selectedDeal ? splitNextStepIntoTasks(selectedDeal.next_step) : [];

  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-950">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-950 text-white">
            <Workflow className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-semibold">WORLDSUN Pipeline v2</h1>
              <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 sm:inline-flex">
                Standalone
              </span>
            </div>
            <div className="text-xs text-zinc-500">{profile.full_name ?? profile.email} · {roleLabel(profile, teams)}</div>
          </div>
          <div className="flex-1" />
          <div className="hidden h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 sm:inline-flex">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Independent Prototype</span>
          </div>
          <div className="hidden h-9 items-center gap-2 rounded-lg bg-zinc-950 px-3 text-sm font-medium text-white md:inline-flex">
            <Sparkles className="h-4 w-4" />
            <span>No Legacy Links</span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[224px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-[73px] lg:h-[calc(100dvh-90px)]">
          <nav className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            {VIEW_ITEMS.map(item => {
              const Icon = item.icon;
              const active = view === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setView(item.key)}
                  className={`flex h-11 items-center gap-2 rounded-lg border px-3 text-left text-sm font-medium transition ${
                    active
                      ? 'border-zinc-950 bg-zinc-950 text-white shadow-sm'
                      : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{item.label}</span>
                  {item.key === 'tasks' && openTasks.length > 0 && (
                    <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      active ? 'bg-white/15 text-white' : 'bg-indigo-50 text-indigo-700'
                    }`}>
                      {openTasks.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="mt-4 hidden rounded-lg border border-zinc-200 bg-white p-3 lg:block">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Access Scope
            </div>
            <div className="mt-2 text-sm font-medium">{roleLabel(profile, teams)}</div>
            <div className="mt-2 text-xs leading-5 text-zinc-500">
              This workspace uses only its local prototype model, seeded records, and in-page state. It has no route, auth, or data dependency on the existing Pipeline.
            </div>
          </div>
        </aside>

        <main className="min-w-0 space-y-4">
          {view === 'cockpit' && (
            <CockpitView
              deals={deals}
              totalAum={totalAum}
              weightedForecast={weightedForecast}
              l4PlusPct={l4PlusPct}
              recentlyMoved={recentlyMoved}
              redFlagDeals={redFlagDeals}
              overdueDeals={overdueDeals}
              paperRiskDeals={paperRiskDeals}
              settings={settings}
              maxStageCount={maxStageCount}
              teamPerformance={teamPerformance}
              onOpenDeal={(dealId) => {
                setSelectedDealId(dealId);
                setView('war-room');
              }}
            />
          )}

          {view === 'desk' && (
            <DeskView
              deals={priorityDeals}
              allDeals={deals}
              tasks={openTasks}
              profiles={allProfiles}
              settings={settings}
              tierCfg={tierCfg}
              overdueTasks={overdueTasks}
              onOpenDeal={(dealId) => {
                setSelectedDealId(dealId);
                setView('war-room');
              }}
            />
          )}

          {view === 'tasks' && (
            <TaskManagementView
              tasks={tasks}
              deals={deals}
              profiles={allProfiles}
              currentProfile={profile}
              onOpenDeal={(dealId) => {
                setSelectedDealId(dealId);
                setView('war-room');
              }}
            />
          )}

          {view === 'war-room' && (
            <WarRoomView
              deals={filteredDeals}
              selectedDeal={selectedDeal}
              selectedWeakScores={selectedWeakScores}
              selectedNextSteps={selectedNextSteps}
              painPoints={painPoints}
              marketIntel={marketIntel}
              settings={settings}
              query={query}
              stageFilter={stageFilter}
              onQueryChange={setQuery}
              onStageFilterChange={setStageFilter}
              onSelectDeal={setSelectedDealId}
            />
          )}

          {view === 'signals' && (
            <SignalsView
              marketIntel={marketIntel}
              deals={deals}
              onOpenDeal={(dealId) => {
                setSelectedDealId(dealId);
                setView('war-room');
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function CockpitView({
  deals,
  totalAum,
  weightedForecast,
  l4PlusPct,
  recentlyMoved,
  redFlagDeals,
  overdueDeals,
  paperRiskDeals,
  settings,
  maxStageCount,
  teamPerformance,
  onOpenDeal,
}: {
  deals: Deal[];
  totalAum: number;
  weightedForecast: number;
  l4PlusPct: number;
  recentlyMoved: number;
  redFlagDeals: Deal[];
  overdueDeals: Deal[];
  paperRiskDeals: Deal[];
  settings: Settings;
  maxStageCount: number;
  teamPerformance: ReturnType<typeof getTeamPerformance>;
  onOpenDeal: (dealId: string) => void;
}) {
  const boardActions = [...redFlagDeals, ...paperRiskDeals, ...overdueDeals]
    .filter((deal, index, list) => list.findIndex(item => item.id === deal.id) === index)
    .slice(0, 4)
    .map(deal => ({ deal, action: nextBestAction(deal, settings, settings.tier_config?.tiers ?? []) }));

  return (
    <>
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile icon={CircleDollarSign} label="Active AUM" value={fmtMoney(totalAum)} note={`${deals.filter(d => d.stage !== 'L7').length} active deals`} tone="emerald" />
        <MetricTile icon={LineChart} label="Weighted Forecast" value={fmtMoney(weightedForecast)} note="Stage probability adjusted" tone="sky" />
        <MetricTile icon={Gauge} label="L4+ Quality Mix" value={`${l4PlusPct}%`} note="Healthy target: 25%+" tone="violet" />
        <MetricTile icon={TimerReset} label="7-Day Movement" value={`${recentlyMoved}`} note="Deals updated this week" tone="amber" />
      </section>

      <section className="grid grid-cols-1 gap-3 2xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Pipeline Flight Path</h2>
              <p className="mt-1 text-xs text-zinc-500">Stage distribution with current probability assumptions.</p>
            </div>
            <BarChart3 className="h-5 w-5 text-zinc-400" />
          </div>
          <div className="mt-4 space-y-2">
            {STAGES.map(stage => {
              const stageDeals = deals.filter(d => d.stage === stage.id);
              const aum = stageDeals.reduce((sum, deal) => sum + Number(deal.aum_usd ?? 0), 0);
              return (
              <button
                key={stage.id}
                onClick={() => stageDeals[0] && onOpenDeal(stageDeals[0].id)}
                className="grid w-full grid-cols-[56px_minmax(0,1fr)_92px] items-center gap-3 rounded-lg border border-transparent p-2 text-left hover:border-zinc-200 hover:bg-zinc-50"
              >
                <span className={`inline-flex h-8 items-center justify-center rounded-md border text-xs font-bold ${stageTone(stage.id)}`}>{stage.id}</span>
                <span className="min-w-0">
                  <span className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium text-zinc-800">{stage.name}</span>
                    <span className="text-xs text-zinc-500">{settings.stage_probs[stage.id]}%</span>
                  </span>
                  <span className="mt-1 block h-2 overflow-hidden rounded-full bg-zinc-100">
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-emerald-500 via-sky-500 to-violet-500"
                      style={{ width: `${Math.max(5, (stageDeals.length / maxStageCount) * 100)}%` }}
                    />
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-sm font-semibold">{stageDeals.length} deals</span>
                  <span className="block text-xs text-zinc-500">{fmtMoney(aum)}</span>
                </span>
              </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Operating Brief</h2>
              <p className="mt-1 text-xs text-zinc-500">What deserves management attention this week.</p>
            </div>
            <Milestone className="h-5 w-5 text-zinc-400" />
          </div>
          <div className="mt-4 space-y-2">
            {boardActions.map(({ deal, action }) => {
              const Icon = action.icon;
              return (
                <button
                  key={deal.id}
                  onClick={() => onOpenDeal(deal.id)}
                  className={`w-full rounded-lg border p-3 text-left transition hover:shadow-sm ${actionToneClass(action.tone)}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/70">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">{action.title}</span>
                        <span className="shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold">{deal.stage}</span>
                      </span>
                      <span className="mt-1 block truncate text-xs opacity-80">{deal.name} · {action.detail}</span>
                    </span>
                  </div>
                </button>
              );
            })}
            {boardActions.length === 0 && <EmptyState icon={CheckCircle2} title="No operating exceptions" body="Pipeline health is calm enough for regular coaching." />}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <RiskColumn
          icon={AlertTriangle}
          title="Qualification Breaks"
          subtitle="MEDDIC score, EB, or freshness issues"
          deals={redFlagDeals}
          empty="No active red flags"
          getMeta={deal => redFlag(deal, settings) ?? 'Review qualification'}
          onOpenDeal={onOpenDeal}
        />
        <RiskColumn
          icon={Bell}
          title="Relationship Decay"
          subtitle="High-risk contact cadence misses"
          deals={overdueDeals}
          empty="Contact rhythm is current"
          getMeta={deal => {
            const info = contactOverdue(deal, settings.tier_config?.tiers ?? []);
            return info ? `${info.deltaDays} days overdue · ${deal.tier ?? 'No tier'}` : 'Review contact date';
          }}
          onOpenDeal={onOpenDeal}
        />
        <RiskColumn
          icon={LockKeyhole}
          title="Paper Process Risk"
          subtitle="Late-stage deals with weak document readiness"
          deals={paperRiskDeals}
          empty="No late-stage paper gaps"
          getMeta={deal => `Paper score ${deal.scores?.p ?? 0}/10`}
          onOpenDeal={onOpenDeal}
        />
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Team Load Board</h2>
            <p className="mt-1 text-xs text-zinc-500">A quick scan of who owns AUM, quality, and qualification depth.</p>
          </div>
          <Users className="h-5 w-5 text-zinc-400" />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 lg:grid-cols-3">
          {teamPerformance.map(row => (
            <div key={row.profile.id} className="rounded-lg border border-zinc-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{row.profile.full_name ?? row.profile.email}</div>
                  <div className="mt-1 text-xs text-zinc-500">{row.owned.length} deals · {row.l4Plus} L4+</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">{fmtMoney(row.aum)}</div>
                  <div className="text-xs text-zinc-500">avg {row.avgScore}/80</div>
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                <div className="h-full rounded-full bg-zinc-950" style={{ width: `${Math.max(8, Math.min(100, (row.avgScore / 80) * 100))}%` }} />
              </div>
            </div>
          ))}
          {teamPerformance.length === 0 && <div className="lg:col-span-3"><EmptyState icon={Users} title="No owner data" body="Deals with RM owners will appear here." /></div>}
        </div>
      </section>
    </>
  );
}

function DeskView({
  deals,
  allDeals,
  tasks,
  profiles,
  settings,
  tierCfg,
  overdueTasks,
  onOpenDeal,
}: {
  deals: Deal[];
  allDeals: Deal[];
  tasks: Task[];
  profiles: Profile[];
  settings: Settings;
  tierCfg: Settings['tier_config']['tiers'];
  overdueTasks: Task[];
  onOpenDeal: (dealId: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Today Queue</h2>
            <p className="mt-1 text-xs text-zinc-500">Priority: red flag, contact decay, late-stage stagnation, then due-soon rhythm.</p>
          </div>
          <Compass className="h-5 w-5 text-zinc-400" />
        </div>
        <div className="mt-4 space-y-2">
          {deals.length === 0 && <EmptyState icon={CheckCircle2} title="Nothing urgent" body="The queue is clear for now." />}
          {deals.map(deal => {
            const reason = priorityReason(deal, settings, tierCfg);
            return (
              <button
                key={deal.id}
                onClick={() => onOpenDeal(deal.id)}
                className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 text-left hover:border-zinc-400 hover:bg-zinc-50"
              >
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border text-xs font-bold ${stageTone(deal.stage)}`}>{deal.stage}</span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold">{deal.name}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${tierTone(deal.tier)}`}>{deal.tier ?? '?'}</span>
                    <span className="text-xs text-zinc-500">{ownerName(deal)}</span>
                  </span>
                  <span className="mt-1 block text-xs text-zinc-500">{reason?.text ?? 'Review next motion'}</span>
                  {deal.next_step && <span className="mt-1 block truncate text-xs text-amber-700">{deal.next_step}</span>}
                </span>
                <span className="text-right">
                  <span className="block text-sm font-semibold">{fmtMoney(Number(deal.aum_usd))}</span>
                  <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${scoreTone(totalScore(deal))}`}>{totalScore(deal)}/80</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <MetricTile icon={ClipboardList} label="Open Tasks" value={`${tasks.length}`} note="Still in flight" tone="sky" />
          <MetricTile icon={AlertTriangle} label="Overdue Tasks" value={`${overdueTasks.length}`} note="Needs a decision" tone="rose" />
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Next-Best Actions</h2>
              <p className="mt-1 text-xs text-zinc-500">Single recommended motion per priority client.</p>
            </div>
            <Sparkles className="h-5 w-5 text-zinc-400" />
          </div>
          <div className="mt-4 space-y-2">
            {deals.slice(0, 4).map(deal => {
              const action = nextBestAction(deal, settings, tierCfg);
              const Icon = action.icon;
              return (
                <button
                  key={deal.id}
                  onClick={() => onOpenDeal(deal.id)}
                  className={`w-full rounded-lg border p-3 text-left ${actionToneClass(action.tone)} hover:shadow-sm`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${actionDotClass(action.tone)}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate text-sm font-semibold">{action.title}</span>
                      </span>
                      <span className="mt-1 block truncate text-xs opacity-80">{deal.name} · {action.detail}</span>
                    </span>
                  </div>
                </button>
              );
            })}
            {deals.length === 0 && <EmptyState icon={CheckCircle2} title="No recommended actions" body="Priority deals will generate recommended motions here." />}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Task Lane</h2>
            <CalendarClock className="h-5 w-5 text-zinc-400" />
          </div>
          <div className="mt-4 space-y-2">
            {tasks.slice(0, 10).map(task => {
              const deal = task.deal_id ? allDeals.find(d => d.id === task.deal_id) : null;
              const assignee = profiles.find(p => p.id === task.assignee_id);
              const days = dueDays(task.due_date);
              return (
                <div key={task.id} className="rounded-lg border border-zinc-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{task.title}</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-zinc-500">
                        <span>{assignee?.full_name ?? 'Unassigned'}</span>
                        {deal && <span>{deal.name}</span>}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      days === null ? 'bg-zinc-100 text-zinc-500' : days < 0 ? 'bg-rose-50 text-rose-700' : days <= 3 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {days === null ? 'No date' : days < 0 ? `${Math.abs(days)}d late` : `${days}d`}
                    </span>
                  </div>
                </div>
              );
            })}
            {tasks.length === 0 && <EmptyState icon={CheckCircle2} title="No open tasks" body="Tasks created from next steps or plans will land here." />}
          </div>
        </div>
      </section>
    </div>
  );
}

function TaskManagementView({
  tasks,
  deals,
  profiles,
  currentProfile,
  onOpenDeal,
}: {
  tasks: Task[];
  deals: Deal[];
  profiles: Profile[];
  currentProfile: Profile;
  onOpenDeal: (dealId: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [dealFilter, setDealFilter] = useState('all');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [taskQuery, setTaskQuery] = useState('');
  const [groupBy, setGroupBy] = useState<TaskGroupKey>('assignee');

  const rows = useMemo(() => {
    return tasks.map(task => ({
      task,
      deal: task.deal_id ? deals.find(deal => deal.id === task.deal_id) ?? null : null,
      assignee: profiles.find(profile => profile.id === task.assignee_id),
      days: dueDays(task.due_date),
    }));
  }, [tasks, deals, profiles]);

  const unfinished = rows.filter(row => row.task.status !== 'done');
  const overdue = unfinished.filter(row => row.days !== null && row.days < 0);
  const dueThisWeek = unfinished.filter(row => row.days !== null && row.days >= 0 && row.days <= 7);
  const assignedToMe = unfinished.filter(row => row.task.assignee_id === currentProfile.id);
  const completed = rows.filter(row => row.task.status === 'done');

  const filteredRows = useMemo(() => {
    const q = taskQuery.trim().toLowerCase();
    const priorityOrder: Record<Task['priority'], number> = { high: 0, normal: 1, low: 2 };
    return rows
      .filter(row => {
        if (statusFilter !== 'all' && row.task.status !== statusFilter) return false;
        if (assigneeFilter !== 'all' && row.task.assignee_id !== assigneeFilter) return false;
        if (dealFilter !== 'all' && (row.task.deal_id ?? 'internal') !== dealFilter) return false;
        if (overdueOnly && !(row.task.status !== 'done' && row.days !== null && row.days < 0)) return false;
        if (!q) return true;
        const hay = `${row.task.title} ${row.task.description} ${row.deal?.name ?? ''} ${row.assignee?.full_name ?? ''}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        const aDone = a.task.status === 'done' ? 1 : 0;
        const bDone = b.task.status === 'done' ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;
        const aDays = a.days ?? 999;
        const bDays = b.days ?? 999;
        if (aDays !== bDays) return aDays - bDays;
        return priorityOrder[a.task.priority] - priorityOrder[b.task.priority];
      });
  }, [rows, statusFilter, assigneeFilter, dealFilter, overdueOnly, taskQuery]);

  const groups = useMemo(() => {
    const map = new Map<string, {
      key: string;
      title: string;
      subtitle: string;
      sortKey: string;
      rows: typeof filteredRows;
    }>();

    filteredRows.forEach(row => {
      let key = '';
      let title = '';
      let subtitle = '';
      let sortKey = '';

      if (groupBy === 'assignee') {
        key = row.assignee?.id ?? 'unassigned';
        title = row.assignee?.full_name ?? '未指派';
        subtitle = row.assignee ? [row.assignee.rm_code, row.assignee.role].filter(Boolean).join(' · ') : 'No owner';
        sortKey = title;
      } else if (groupBy === 'deal') {
        key = row.deal?.id ?? 'internal';
        title = row.deal?.name ?? 'COO / 內部營運';
        subtitle = row.deal ? `${ownerName(row.deal)} · ${row.deal.stage} · ${fmtMoney(Number(row.deal.aum_usd))}` : 'No linked client';
        sortKey = title;
      } else if (row.task.status === 'done') {
        key = 'done';
        title = '已完成';
        subtitle = 'Completed tasks';
        sortKey = '5';
      } else if (row.days === null) {
        key = 'no-date';
        title = '未排期';
        subtitle = 'Needs owner decision';
        sortKey = '4';
      } else if (row.days < 0) {
        key = 'overdue';
        title = '已逾期';
        subtitle = 'COO needs to clear blockers today';
        sortKey = '0';
      } else if (row.days === 0) {
        key = 'today';
        title = '今天到期';
        subtitle = 'Due before end of day';
        sortKey = '1';
      } else if (row.days <= 7) {
        key = 'week';
        title = '本週到期';
        subtitle = 'Due in the next seven days';
        sortKey = '2';
      } else {
        key = 'later';
        title = '稍後到期';
        subtitle = 'Scheduled beyond this week';
        sortKey = '3';
      }

      const group = map.get(key) ?? { key, title, subtitle, sortKey, rows: [] };
      group.rows.push(row);
      map.set(key, group);
    });

    return Array.from(map.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [filteredRows, groupBy]);

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <ClipboardList className="h-4 w-4 text-indigo-600" />
              COO Task Control
            </div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">任務管理</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500">
              給 COO 每天追蹤任務進度：誰負責、哪件逾期、哪些本週要完成、哪些已經卡住需要協調。
            </p>
          </div>
          <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-800">
            <Plus className="h-4 w-4" />
            新增任務
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <MetricTile icon={ClipboardList} label="未完成" value={`${unfinished.length}`} note="todo + in progress" tone="sky" />
        <MetricTile icon={AlertTriangle} label="已逾期" value={`${overdue.length}`} note="needs COO unblock" tone="rose" />
        <MetricTile icon={CalendarClock} label="本週到期" value={`${dueThisWeek.length}`} note="next 7 days" tone="amber" />
        <MetricTile icon={UserCheck} label="指派給我" value={`${assignedToMe.length}`} note={currentProfile.full_name ?? 'current user'} tone="violet" />
        <MetricTile icon={CheckCircle2} label="已完成" value={`${completed.length}`} note="visible for daily review" tone="emerald" />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          <SlidersHorizontal className="h-4 w-4" />
          Filters
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[160px_190px_190px_auto_minmax(220px,1fr)_180px]">
          <select
            value={statusFilter}
            onChange={event => setStatusFilter(event.target.value as TaskStatusFilter)}
            className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 outline-none focus:border-zinc-400"
          >
            <option value="all">全部狀態</option>
            <option value="todo">待辦</option>
            <option value="doing">進行中</option>
            <option value="done">完成</option>
          </select>
          <select
            value={assigneeFilter}
            onChange={event => setAssigneeFilter(event.target.value)}
            className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 outline-none focus:border-zinc-400"
          >
            <option value="all">全部指派</option>
            {profiles.map(item => (
              <option key={item.id} value={item.id}>{item.full_name ?? item.email}</option>
            ))}
          </select>
          <select
            value={dealFilter}
            onChange={event => setDealFilter(event.target.value)}
            className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 outline-none focus:border-zinc-400"
          >
            <option value="all">全部案件</option>
            <option value="internal">COO / 內部營運</option>
            {deals.map(deal => (
              <option key={deal.id} value={deal.id}>{deal.name}</option>
            ))}
          </select>
          <button
            onClick={() => setOverdueOnly(value => !value)}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold ${
              overdueOnly ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            只看逾期
          </button>
          <div className="flex h-10 items-center gap-2 rounded-lg border border-zinc-200 px-3">
            <Search className="h-4 w-4 shrink-0 text-zinc-400" />
            <input
              value={taskQuery}
              onChange={event => setTaskQuery(event.target.value)}
              placeholder="搜尋任務 / 客戶 / 指派人..."
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <select
            value={groupBy}
            onChange={event => setGroupBy(event.target.value as TaskGroupKey)}
            className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 outline-none focus:border-zinc-400"
          >
            <option value="assignee">分組: 指派人</option>
            <option value="deal">分組: 案件</option>
            <option value="due">分組: 到期日</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {groups.map(group => {
          const openCount = group.rows.filter(row => row.task.status !== 'done').length;
          const doneCount = group.rows.length - openCount;
          return (
            <section key={group.key} className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-zinc-100 bg-zinc-50 px-4 py-3">
                <div>
                  <h3 className="text-sm font-semibold">{group.title}</h3>
                  <p className="mt-0.5 text-xs text-zinc-500">{group.subtitle}</p>
                </div>
                <div className="text-right text-xs text-zinc-500">
                  <div className="font-semibold text-zinc-700">{group.rows.length} 件</div>
                  <div>{doneCount} 完成 · {openCount} 未完成</div>
                </div>
              </div>

              <div className="divide-y divide-zinc-100">
                {group.rows.map(row => (
                  <div key={row.task.id} className={`grid grid-cols-[auto_minmax(0,1fr)] gap-3 px-4 py-3 lg:grid-cols-[auto_minmax(0,1fr)_auto] ${row.task.status === 'done' ? 'opacity-60' : ''}`}>
                    <input
                      type="checkbox"
                      checked={row.task.status === 'done'}
                      readOnly
                      aria-label={`${row.task.title} completion status`}
                      className="mt-1 h-4 w-4 rounded border-zinc-300 text-zinc-950"
                    />
                    <div className="min-w-0">
                      <div className={`text-sm font-semibold ${row.task.status === 'done' ? 'line-through text-zinc-400' : 'text-zinc-950'}`}>
                        {row.task.title}
                      </div>
                      {row.task.description && <div className="mt-1 text-xs leading-5 text-zinc-500">{row.task.description}</div>}
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {row.assignee?.full_name ?? '未指派'}
                        </span>
                        {row.deal ? (
                          <button onClick={() => onOpenDeal(row.deal!.id)} className="inline-flex items-center gap-1 font-medium text-indigo-700 hover:text-indigo-900">
                            <BriefcaseBusiness className="h-3.5 w-3.5" />
                            {row.deal.name}
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            COO / 內部營運
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3.5 w-3.5" />
                          {fmtDate(row.task.due_date)}
                        </span>
                      </div>
                    </div>
                    <div className="col-span-2 flex flex-wrap items-center gap-2 lg:col-span-1 lg:justify-end">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${taskPriorityClass(row.task.priority)}`}>
                        {taskPriorityLabel(row.task.priority)}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${taskDueClass(row.days, row.task.status)}`}>
                        {taskDueLabel(row.days, row.task.status)}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${taskStatusClass(row.task.status)}`}>
                        {taskStatusLabel(row.task.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
        {groups.length === 0 && <EmptyState icon={ClipboardList} title="沒有符合條件的任務" body="調整篩選條件後，COO 可以重新檢視每日追蹤清單。" />}
      </div>
    </section>
  );
}

function WarRoomView({
  deals,
  selectedDeal,
  selectedWeakScores,
  selectedNextSteps,
  painPoints,
  marketIntel,
  settings,
  query,
  stageFilter,
  onQueryChange,
  onStageFilterChange,
  onSelectDeal,
}: {
  deals: Deal[];
  selectedDeal: Deal | null;
  selectedWeakScores: ReturnType<typeof getWeakestScores>;
  selectedNextSteps: string[];
  painPoints: PainPoint[];
  marketIntel: MarketIntel[];
  settings: Settings;
  query: string;
  stageFilter: StageId | '';
  onQueryChange: (value: string) => void;
  onStageFilterChange: (value: StageId | '') => void;
  onSelectDeal: (dealId: string) => void;
}) {
  if (!selectedDeal) {
    return <EmptyState icon={BriefcaseBusiness} title="No deals yet" body="Add a standalone record to this workspace to start the war-room flow." />;
  }

  const comments = (selectedDeal.comments ?? [])
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 4);
  const planSteps = selectedDeal.plan?.steps ?? [];
  const action = nextBestAction(selectedDeal, settings, settings.tier_config?.tiers ?? []);
  const ActionIcon = action.icon;
  const paperItems = getPaperItems(selectedDeal);
  const relatedIntel = linkedIntelForDeal(selectedDeal, marketIntel);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
      <section className="rounded-xl border border-zinc-200 bg-white p-3">
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2">
          <Search className="h-4 w-4 text-zinc-400" />
          <input
            value={query}
            onChange={event => onQueryChange(event.target.value)}
            placeholder="Search clients, products, next steps"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          {query && (
            <button onClick={() => onQueryChange('')} aria-label="Clear search" className="text-zinc-400 hover:text-zinc-700">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => onStageFilterChange('')}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${stageFilter === '' ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-200 text-zinc-600'}`}
          >
            All
          </button>
          {STAGES.map(stage => (
            <button
              key={stage.id}
              onClick={() => onStageFilterChange(stage.id)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${stageFilter === stage.id ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-200 text-zinc-600'}`}
            >
              {stage.id}
            </button>
          ))}
        </div>
        <div className="mt-3 max-h-[calc(100dvh-232px)] space-y-2 overflow-y-auto pr-1 scrollbar-thin">
          {deals.map(deal => {
            const active = deal.id === selectedDeal.id;
            return (
              <button
                key={deal.id}
                onClick={() => onSelectDeal(deal.id)}
                className={`w-full rounded-lg border p-3 text-left transition ${
                  active ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-200 bg-white hover:border-zinc-400 hover:bg-zinc-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{deal.name}</div>
                    <div className={`mt-1 text-xs ${active ? 'text-zinc-300' : 'text-zinc-500'}`}>{ownerName(deal)} · {fmtMoney(Number(deal.aum_usd))}</div>
                  </div>
                  <span className={`rounded-md border px-2 py-1 text-xs font-bold ${active ? 'border-white/20 bg-white/10 text-white' : stageTone(deal.stage)}`}>{deal.stage}</span>
                </div>
                <div className={`mt-2 h-1.5 overflow-hidden rounded-full ${active ? 'bg-white/20' : 'bg-zinc-100'}`}>
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(3, (totalScore(deal) / 80) * 100)}%` }} />
                </div>
              </button>
            );
          })}
          {deals.length === 0 && <div className="py-8 text-center text-sm text-zinc-400">No matching deals</div>}
        </div>
      </section>

      <section className="space-y-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-md border px-2 py-1 text-xs font-bold ${stageTone(selectedDeal.stage)}`}>{selectedDeal.stage}</span>
                <span className={`rounded-md border px-2 py-1 text-xs font-bold ${tierTone(selectedDeal.tier)}`}>{selectedDeal.tier ?? 'No tier'}</span>
                <span className={`rounded-md border px-2 py-1 text-xs font-bold ${scoreTone(totalScore(selectedDeal))}`}>{totalScore(selectedDeal)}/80</span>
              </div>
              <h2 className="mt-3 truncate text-2xl font-semibold tracking-tight">{selectedDeal.name}</h2>
              <div className="mt-1 flex flex-wrap gap-2 text-sm text-zinc-500">
                <span>{ownerName(selectedDeal)}</span>
                <span>{selectedDeal.product || 'No product target'}</span>
                <span>{fmtMoney(Number(selectedDeal.aum_usd))}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[520px]">
              <MiniFact icon={Route} label="Stage Prob." value={`${settings.stage_probs[selectedDeal.stage] ?? 0}%`} />
              <MiniFact icon={Activity} label="Updated" value={`${daysSince(selectedDeal.last_updated)}d`} />
              <MiniFact icon={Bell} label="Contact" value={selectedDeal.last_contact_at ? `${daysSince(selectedDeal.last_contact_at)}d` : 'None'} />
              <MiniFact icon={FileText} label="Files" value={`${selectedDeal.deal_attachments?.length ?? 0}`} />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-7 gap-1">
            {STAGES.map(stage => {
              const passed = stageIdx(stage.id) <= stageIdx(selectedDeal.stage);
              return (
                <div key={stage.id} className="min-w-0">
                  <div className={`h-2 rounded-full ${passed ? 'bg-zinc-950' : 'bg-zinc-200'}`} />
                  <div className="mt-1 truncate text-center text-[10px] font-semibold text-zinc-500">{stage.id}</div>
                </div>
              );
            })}
          </div>
        </div>

        <section className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className={`rounded-xl border p-4 ${actionToneClass(action.tone)}`}>
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/70">
                <ActionIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold uppercase tracking-wide opacity-70">Command Focus</div>
                <h3 className="mt-1 text-lg font-semibold">{action.title}</h3>
                <p className="mt-1 text-sm opacity-85">{action.detail}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Decision Map</h3>
              <Network className="h-5 w-5 text-zinc-400" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <DecisionScore label="EB" value={selectedDeal.scores?.e ?? 0} />
              <DecisionScore label="Champion" value={selectedDeal.scores?.c1 ?? 0} />
              <DecisionScore label="Competition" value={selectedDeal.scores?.c2 ?? 0} />
            </div>
            <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs leading-5 text-zinc-600">
              <span className="font-semibold text-zinc-800">Owner:</span> {ownerName(selectedDeal)} · <span className="font-semibold text-zinc-800">Product:</span> {selectedDeal.product || '未設定'}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Paper Process Tracker</h3>
              <p className="mt-1 text-xs text-zinc-500">A visual proxy for the MEDDPICC paper-process risk before L6.</p>
            </div>
            <Paperclip className="h-5 w-5 text-zinc-400" />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
            {paperItems.map(item => (
              <div key={item.label} className={`rounded-lg border p-3 ${statusClass(item.status)}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm font-semibold">{item.label}</div>
                  <span className="shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold">{statusLabel(item.status)}</span>
                </div>
                <div className="mt-2 line-clamp-2 text-xs opacity-80">{item.detail}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">MEDDPICC Gap Lens</h3>
              <Sparkles className="h-5 w-5 text-zinc-400" />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {MEDDIC.map(item => {
                const score = selectedDeal.scores?.[item.key] ?? 0;
                return (
                  <div key={item.key}>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium">{item.label}</span>
                      <span className="font-semibold">{score}/10</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className={`h-full rounded-full ${score >= 8 ? 'bg-emerald-500' : score >= 5 ? 'bg-sky-500' : score >= 3 ? 'bg-amber-500' : 'bg-rose-500'}`}
                        style={{ width: `${score * 10}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
              {selectedWeakScores.map(item => (
                <div key={item.key} className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                  <div className="text-xs font-semibold text-rose-700">{item.label}</div>
                  <div className="mt-1 text-2xl font-bold text-rose-800">{item.score}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-rose-700/80">{item.hint}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Next Motion</h3>
              <ChevronRight className="h-5 w-5 text-zinc-400" />
            </div>
            <div className="mt-4 space-y-2">
              {selectedNextSteps.map((step, index) => (
                <div key={`${step}-${index}`} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                  <div className="text-xs font-semibold text-amber-700">Action {index + 1}</div>
                  <div className="mt-1">{step}</div>
                </div>
              ))}
              {selectedNextSteps.length === 0 && <EmptyState icon={ClipboardList} title="No next step recorded" body="Use the current detail modal to add concrete next actions." />}
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <DetailPanel title="Plan Steps" icon={Route}>
            {planSteps.length > 0 ? (
              <div className="space-y-2">
                {planSteps.slice(0, 4).map((step, index) => (
                  <div key={step.id} className="rounded-lg border border-zinc-200 p-3">
                    <div className="text-xs font-semibold text-zinc-500">Step {index + 1} · {step.target_date}</div>
                    <div className="mt-1 text-sm font-medium">{step.title}</div>
                    <div className="mt-1 text-xs text-zinc-500">{step.stage_transition}</div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={Route} title="No AI plan yet" body="Generate one in the current deal modal when ready." />
            )}
          </DetailPanel>

          <DetailPanel title="Decision Proof" icon={MessageSquareText}>
            {(selectedDeal.score_notes ?? []).filter(note => note.evidence || note.next_action).slice(0, 5).map(note => (
              <div key={note.field} className="rounded-lg border border-zinc-200 p-3">
                <div className="text-xs font-semibold uppercase text-zinc-500">{note.field}</div>
                {note.evidence && <div className="mt-1 text-sm">{note.evidence}</div>}
                {note.next_action && <div className="mt-1 text-xs text-sky-700">{note.next_action}</div>}
              </div>
            ))}
            {!(selectedDeal.score_notes ?? []).some(note => note.evidence || note.next_action) && (
              <EmptyState icon={MessageSquareText} title="No proof notes" body="Evidence notes make the score auditable." />
            )}
          </DetailPanel>

          <DetailPanel title="Field Memory" icon={FileText}>
            {comments.map(comment => (
              <div key={comment.id} className="rounded-lg border border-zinc-200 p-3">
                <div className="text-xs text-zinc-500">{new Date(comment.created_at).toLocaleDateString('zh-TW')}</div>
                <div className="mt-1 line-clamp-3 text-sm">{comment.body}</div>
              </div>
            ))}
            {comments.length === 0 && <EmptyState icon={FileText} title="No notes yet" body="Raw conversations and comments will appear here." />}
          </DetailPanel>
        </div>

        {relatedIntel.length > 0 && (
          <section className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Linked Market Signals</h3>
              <BrainCircuit className="h-5 w-5 text-zinc-400" />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 lg:grid-cols-3">
              {relatedIntel.map(intel => (
                <div key={intel.id} className="rounded-lg border border-zinc-200 p-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">{intel.region}</span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">{STANCE_LABEL[intel.stance]}</span>
                  </div>
                  <div className="mt-2 line-clamp-2 text-sm font-semibold">{intel.title}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-zinc-500">{intel.summary}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Pain-to-Product Library</h3>
            <BriefcaseBusiness className="h-5 w-5 text-zinc-400" />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {painPoints.slice(0, 6).map(point => (
              <div key={point.id} className="rounded-lg border border-zinc-200 p-3">
                <div className="text-sm font-semibold">{point.pain}</div>
                <div className="mt-1 text-sm text-sky-700">{point.product}</div>
                <div className="mt-1 line-clamp-2 text-xs text-zinc-500">{point.pitch}</div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}

function SignalsView({
  marketIntel,
  deals,
  onOpenDeal,
}: {
  marketIntel: MarketIntel[];
  deals: Deal[];
  onOpenDeal: (dealId: string) => void;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Market Signals Board</h2>
          <p className="mt-1 text-xs text-zinc-500">Standalone signals, stances, tags, and client relevance curated inside this prototype.</p>
        </div>
        <div className="flex gap-2">
          <div className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 px-3 text-sm font-medium text-zinc-600">
            <FileText className="h-4 w-4" />
            Capture Signal
          </div>
          <div className="inline-flex h-9 items-center gap-2 rounded-lg bg-zinc-950 px-3 text-sm font-medium text-white">
            <Sparkles className="h-4 w-4" />
            Synthesis
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
        {marketIntel.map(intel => (
          <article key={intel.id} className="rounded-lg border border-zinc-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] font-semibold text-zinc-600">{intel.region}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    intel.stance === 'bullish' ? 'bg-emerald-50 text-emerald-700' :
                    intel.stance === 'bearish' ? 'bg-rose-50 text-rose-700' :
                    'bg-zinc-100 text-zinc-600'
                  }`}>{STANCE_LABEL[intel.stance]}</span>
                </div>
                <h3 className="mt-2 line-clamp-2 text-sm font-semibold">{intel.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm text-zinc-600">{intel.summary}</p>
              </div>
              <TrendingUp className="h-5 w-5 shrink-0 text-zinc-300" />
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {(intel.tags ?? []).slice(0, 5).map(tag => (
                <span key={tag.id} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600">{tag.name}</span>
              ))}
            </div>
            {(intel.deal_links ?? []).length > 0 && (
              <div className="mt-3 space-y-1 border-t border-zinc-100 pt-3">
                {(intel.deal_links ?? []).slice(0, 3).map(link => {
                  const deal = deals.find(d => d.id === link.deal_id);
                  return (
                    <button
                      key={link.deal_id}
                      onClick={() => onOpenDeal(link.deal_id)}
                      className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1 text-left text-xs hover:bg-zinc-50"
                    >
                      <span className="truncate">{deal?.name ?? link.deal?.name ?? 'Linked client'}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                    </button>
                  );
                })}
              </div>
            )}
          </article>
        ))}
      </div>

      {marketIntel.length === 0 && <EmptyState icon={BrainCircuit} title="No market signals yet" body="Standalone signal records will appear on this board." />}
    </section>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  note,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  note: string;
  tone: 'emerald' | 'sky' | 'violet' | 'amber' | 'rose';
}) {
  const toneClass = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    sky: 'bg-sky-50 text-sky-700 border-sky-200',
    violet: 'bg-violet-50 text-violet-700 border-violet-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
  }[tone];

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500">{label}</span>
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-zinc-500">{note}</div>
    </div>
  );
}

function RiskColumn({
  icon: Icon,
  title,
  subtitle,
  deals,
  empty,
  getMeta,
  onOpenDeal,
}: {
  icon: typeof AlertTriangle;
  title: string;
  subtitle: string;
  deals: Deal[];
  empty: string;
  getMeta: (deal: Deal) => string;
  onOpenDeal: (dealId: string) => void;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>
        </div>
        <Icon className="h-5 w-5 text-zinc-400" />
      </div>
      <div className="mt-4 space-y-2">
        {deals.slice(0, 5).map(deal => (
          <button
            key={deal.id}
            onClick={() => onOpenDeal(deal.id)}
            className="flex w-full items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 text-left hover:border-zinc-400 hover:bg-zinc-50"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{deal.name}</span>
              <span className="mt-1 block truncate text-xs text-zinc-500">{getMeta(deal)}</span>
            </span>
            <span className="shrink-0 text-sm font-semibold">{fmtMoney(Number(deal.aum_usd))}</span>
          </button>
        ))}
        {deals.length === 0 && <div className="rounded-lg border border-dashed border-zinc-200 p-5 text-center text-sm text-zinc-400">{empty}</div>}
      </div>
    </section>
  );
}

function MiniFact({ icon: Icon, label, value }: { icon: typeof Route; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function DecisionScore({ label, value }: { label: string; value: number }) {
  const status = scoreStatus(value);
  return (
    <div className={`rounded-lg border p-3 text-center ${statusClass(status)}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}

function DetailPanel({ title, icon: Icon, children }: { title: string; icon: typeof Route; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Icon className="h-5 w-5 text-zinc-400" />
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function EmptyState({ icon: Icon, title, body }: { icon: typeof CheckCircle2; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-200 p-6 text-center">
      <Icon className="mx-auto h-6 w-6 text-zinc-300" />
      <div className="mt-2 text-sm font-semibold text-zinc-600">{title}</div>
      <div className="mt-1 text-xs text-zinc-400">{body}</div>
    </div>
  );
}
