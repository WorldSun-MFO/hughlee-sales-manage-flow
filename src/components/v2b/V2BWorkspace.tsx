'use client';

/**
 * V2BWorkspace — WORLDSUN Pipeline 的「第二個設計方向」原型。
 *
 * 與 /v2 共用同一份隔離假資料（@/components/v2/data）與型別（@/components/v2/model），
 * 但刻意換一套版面語言，讓 Hugh 能把兩種設計並排比較：
 *
 *   /v2   — 左側 sidebar + 卡片網格（cockpit / grid 風格）
 *   /v2b  — 頂部 segmented nav + 常駐風險條 + 報表式橫向帶狀 + 問題導向作戰室
 *
 * 設計語言完全遵守 docs/V2_DESIGN_HANDOFF.md：
 *   bg zinc-50 / text zinc-950 / 白底卡片 border-zinc-200 / rounded-lg|xl
 *   重要動作 zinc-950；風險 rose、跟進 amber、進度好 emerald、分析 sky/violet
 *   不做 hero、不做行銷 slogan、保持儀表板密度。
 *
 * 依舊版 GPT UX 檢視回饋強化（2026-05-18）：
 *   ① 清單固定欄位結構（可掃描，不是自然文字流）
 *   ② 任務到期日分級 badge + 左側狀態色條 + 完成項收一行
 *   ③ RM quick filters（今天要追 / 7 天未更新 / 高 AUM / L4+ / 紅旗 / EB 未確認 / 逾期）
 *   ④ KPI 卡可點擊 drill-down 到對應篩選
 *   ⑤ 風險顏色分級（EB 未確認＝紅、總分過低／未更新＝橘）
 *   ⑥ 可讀性：放大最小字、加深次要灰，給 40–55 歲金融使用者
 *   ⑦ 「記錄已聯繫」低摩擦 inline 選單（純本地 state，不接 Supabase）
 *   ⑧ 階段機率標示
 *
 * 純前端原型：不讀 Supabase、不走舊登入、不引用 @/lib/types|constants|utils。
 */

import { useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  ClipboardList,
  Clock,
  Compass,
  Crown,
  FileText,
  Filter,
  Flag,
  Gauge,
  LayoutDashboard,
  ListChecks,
  Mail,
  MessageCircle,
  MessageSquare,
  Newspaper,
  Phone,
  Plus,
  Radar,
  Route,
  Search,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
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
} from '@/components/v2/model';

// ============================================================================
// Tokens
// ============================================================================

type ToneKey = 'risk' | 'warn' | 'good' | 'info' | 'accent' | 'zinc';

const TONE: Record<ToneKey, { text: string; soft: string; ring: string; dot: string; solid: string; borderL: string }> = {
  risk: { text: 'text-rose-700', soft: 'bg-rose-50', ring: 'border-rose-200', dot: 'bg-rose-500', solid: 'bg-rose-600', borderL: 'border-l-rose-400' },
  warn: { text: 'text-amber-700', soft: 'bg-amber-50', ring: 'border-amber-200', dot: 'bg-amber-500', solid: 'bg-amber-500', borderL: 'border-l-amber-400' },
  good: { text: 'text-emerald-700', soft: 'bg-emerald-50', ring: 'border-emerald-200', dot: 'bg-emerald-500', solid: 'bg-emerald-600', borderL: 'border-l-emerald-400' },
  info: { text: 'text-sky-700', soft: 'bg-sky-50', ring: 'border-sky-200', dot: 'bg-sky-500', solid: 'bg-sky-600', borderL: 'border-l-sky-400' },
  accent: { text: 'text-violet-700', soft: 'bg-violet-50', ring: 'border-violet-200', dot: 'bg-violet-500', solid: 'bg-violet-600', borderL: 'border-l-violet-400' },
  zinc: { text: 'text-zinc-600', soft: 'bg-zinc-50', ring: 'border-zinc-200', dot: 'bg-zinc-400', solid: 'bg-zinc-900', borderL: 'border-l-zinc-300' },
};

type ViewKey = 'cockpit' | 'desk' | 'war' | 'signals' | 'tasks';

const VIEWS: { key: ViewKey; label: string; sub: string; icon: LucideIcon }[] = [
  { key: 'cockpit', label: 'Executive Cockpit', sub: '整體風險與漏斗', icon: LayoutDashboard },
  { key: 'desk', label: 'RM Daily Desk', sub: '今天該追誰', icon: Zap },
  { key: 'war', label: 'Deal War Room', sub: '單案作戰', icon: Target },
  { key: 'signals', label: 'Market Signals', sub: '市場彈藥', icon: Radar },
  { key: 'tasks', label: 'Task Manager', sub: '全團隊任務', icon: ClipboardList },
];

const STAGE_LABEL: Record<StageId, string> = STAGES.reduce(
  (acc, s) => ({ ...acc, [s.id]: s.name }),
  {} as Record<StageId, string>,
);

const STAGE_TONE: Record<StageId, ToneKey> = {
  L1: 'zinc',
  L2: 'zinc',
  L3: 'info',
  L4: 'accent',
  L5: 'accent',
  L6: 'warn',
  L7: 'good',
};

function tierTone(tier: string | null): ToneKey {
  if (tier === 'SSS' || tier === 'S') return 'accent';
  if (tier === 'A') return 'info';
  return 'zinc';
}

function fmtMD(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getMonth() + 1}／${d.getDate()}`;
}

function actionFor(reasonIcon: string | undefined): { verb: string; t: ToneKey } {
  if (reasonIcon === 'red-flag') return { verb: '優先處理', t: 'risk' };
  if (reasonIcon === 'contact') return { verb: '立即聯繫', t: 'warn' };
  if (reasonIcon === 'stale') return { verb: '推進卡關', t: 'warn' };
  return { verb: '跟進', t: 'info' };
}

// ⑤ 風險分級：阻塞成交＝紅（rose）、需追蹤未必立即危險＝橘（amber）。對齊交付包 Risk Badge 規則。
function flagTone(flag: string | null): ToneKey {
  if (!flag) return 'zinc';
  if (flag.includes('EB')) return 'risk';
  return 'warn';
}

type TaskBucket = 'late' | 'soon' | 'later' | 'done';

function taskBucket(t: Task): TaskBucket {
  if (t.status === 'done') return 'done';
  if (!t.due_date) return 'later';
  const delta = (new Date(`${t.due_date}T00:00:00`).getTime() - Date.now()) / 86_400_000;
  if (delta < 0) return 'late';
  if (delta <= 3) return 'soon';
  return 'later';
}

// ② 到期日分級 badge
function dueBadge(due: string | null): { label: string; t: ToneKey } {
  if (!due) return { label: '無期限', t: 'zinc' };
  const d = new Date(`${due}T00:00:00`);
  if (Number.isNaN(d.getTime())) return { label: '無期限', t: 'zinc' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return { label: `逾期 ${Math.abs(days)} 天`, t: 'risk' };
  if (days === 0) return { label: '今天', t: 'warn' };
  if (days === 1) return { label: '明天', t: 'warn' };
  return { label: `${days} 天後`, t: 'zinc' };
}

// ③④ RM quick filters（也供 KPI drill-down 使用）
type QuickKey = 'all' | 'today' | 'overdue' | 'stale7' | 'highaum' | 'l4plus' | 'redflag' | 'eb';

const QUICK_FILTERS: { key: QuickKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'today', label: '今天要追' },
  { key: 'overdue', label: '逾期聯繫' },
  { key: 'stale7', label: '7 天未更新' },
  { key: 'highaum', label: '高 AUM' },
  { key: 'l4plus', label: 'L4 以上' },
  { key: 'redflag', label: '紅旗' },
  { key: 'eb', label: 'EB 未確認' },
];

const QUICK_LABEL: Record<QuickKey, string> = QUICK_FILTERS.reduce(
  (acc, q) => ({ ...acc, [q.key]: q.label }),
  {} as Record<QuickKey, string>,
);

function matchQuick(
  d: Deal,
  key: QuickKey,
  settings: Settings,
  tiers: Settings['tier_config']['tiers'],
): boolean {
  switch (key) {
    case 'all':
      return true;
    case 'today':
      return Boolean(priorityReason(d, settings, tiers));
    case 'overdue':
      return contactOverdue(d, tiers)?.status === 'overdue';
    case 'stale7':
      return daysSince(d.last_updated) >= 7;
    case 'highaum': {
      const sMin = tiers.find((t) => t.key === 'S')?.aum_min ?? 50_000_000;
      return d.aum_usd >= sMin;
    }
    case 'l4plus':
      return stageIdx(d.stage) >= 3;
    case 'redflag':
      return Boolean(redFlag(d, settings));
    case 'eb':
      return (d.scores?.e ?? 0) < settings.red_flag.ebScore;
    default:
      return true;
  }
}

// ============================================================================
// Atoms
// ============================================================================

function Tag({ t = 'zinc', children }: { t?: ToneKey; children: ReactNode }) {
  const c = TONE[t];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium', c.soft, c.ring, c.text)}>
      {children}
    </span>
  );
}

function Dot({ t }: { t: ToneKey }) {
  return <span className={cn('inline-block h-1.5 w-1.5 rounded-full', TONE[t].dot)} />;
}

function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-xl border border-zinc-200 bg-white', className)}>{children}</div>;
}

function PanelHead({ icon: Icon, t, q, hint }: { icon: LucideIcon; t: ToneKey; q: string; hint?: string }) {
  return (
    <div className="flex items-start gap-2.5 border-b border-zinc-100 px-4 py-3">
      <span className={cn('mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border', TONE[t].soft, TONE[t].ring, TONE[t].text)}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="text-[15px] font-semibold text-zinc-950">{q}</div>
        {hint ? <div className="mt-0.5 text-xs text-zinc-500">{hint}</div> : null}
      </div>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="px-4 py-6 text-center text-sm text-zinc-400">{children}</div>;
}

// ⑦ 低摩擦「記錄已聯繫」inline 選單。純本地 state，示範互動設計，不接 Supabase。
function ContactLog() {
  const [open, setOpen] = useState<false | 'channel' | 'when'>(false);
  const [channel, setChannel] = useState<string | null>(null);
  const [done, setDone] = useState<{ channel: string; when: string } | null>(null);

  const channels: { l: string; Icon: LucideIcon }[] = [
    { l: '電話', Icon: Phone },
    { l: 'LINE', Icon: MessageCircle },
    { l: 'Email', Icon: Mail },
    { l: '面談', Icon: Users },
  ];

  if (done) {
    return (
      <div className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] font-medium text-emerald-700">
        <Check className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          已記錄 · {done.channel} · 下次 {done.when}
        </span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(open ? false : 'channel')}
        className="flex w-full items-center justify-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
      >
        <Phone className="h-3.5 w-3.5" /> 記錄已聯繫
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-1 w-44 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg">
          {open === 'channel' ? (
            <div>
              <div className="px-1 pb-1.5 text-[11px] font-semibold text-zinc-500">用什麼方式聯繫？</div>
              <div className="grid grid-cols-2 gap-1">
                {channels.map((c) => (
                  <button
                    key={c.l}
                    type="button"
                    onClick={() => {
                      setChannel(c.l);
                      setOpen('when');
                    }}
                    className="flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1.5 text-xs text-zinc-700 hover:border-zinc-950"
                  >
                    <c.Icon className="h-3.5 w-3.5 shrink-0" /> {c.l}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="px-1 pb-1.5 text-[11px] font-semibold text-zinc-500">下次追蹤？</div>
              <div className="space-y-1">
                {['明天', '3 天後', '下週', '自訂'].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => {
                      setDone({ channel: channel ?? '聯繫', when: w });
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-lg border border-zinc-200 px-2 py-1.5 text-xs text-zinc-700 hover:border-zinc-950"
                  >
                    {w}
                    <ChevronRight className="h-3 w-3 text-zinc-400" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ============================================================================
// Workspace
// ============================================================================

interface V2BWorkspaceProps {
  deals: Deal[];
  profile: Profile;
  profiles: Profile[];
  settings: Settings;
  tasks: Task[];
  painPoints: PainPoint[];
  marketIntel: MarketIntel[];
}

export function V2BWorkspace({ deals, profile, profiles, settings, tasks, painPoints, marketIntel }: V2BWorkspaceProps) {
  const tiers = settings.tier_config.tiers;

  const nameOfRm = useMemo(() => {
    const map = new Map<string, string>();
    profiles.forEach((p) => map.set(p.id, p.full_name ?? p.email));
    return (id: string) => map.get(id) ?? '—';
  }, [profiles]);

  const active = useMemo(() => deals.filter((d) => d.stage !== 'L7'), [deals]);

  const ranked = useMemo(
    () =>
      active
        .map((d) => ({ d, u: urgencyScore(d, settings, tiers), r: priorityReason(d, settings, tiers) }))
        .sort((a, b) => b.u - a.u),
    [active, settings, tiers],
  );

  const queue = useMemo(() => ranked.filter((x) => x.r), [ranked]);

  const kpi = useMemo(() => {
    const pipelineAum = active.reduce((s, d) => s + d.aum_usd, 0);
    const weighted = active.reduce((s, d) => s + (d.aum_usd * (settings.stage_probs[d.stage] ?? 0)) / 100, 0);
    const l4 = active.filter((d) => stageIdx(d.stage) >= 3).length;
    const l4ratio = active.length ? Math.round((l4 / active.length) * 100) : 0;
    const flags = active.filter((d) => redFlag(d, settings));
    const overdue = active.filter((d) => contactOverdue(d, tiers)?.status === 'overdue');
    return { pipelineAum, weighted, l4ratio, flags, overdue };
  }, [active, settings, tiers]);

  const [view, setView] = useState<ViewKey>('cockpit');
  const [dealId, setDealId] = useState<string | null>(queue[0]?.d.id ?? deals[0]?.id ?? null);
  const [warQuick, setWarQuick] = useState<QuickKey>('all');

  const goToDeal = (id: string) => {
    setDealId(id);
    setView('war');
  };

  // ④ KPI / 風險條 drill-down：帶著 quick filter 跳進 War Room
  const openWar = (q: QuickKey) => {
    setWarQuick(q);
    setView('war');
  };

  const goTasks = () => setView('tasks');

  const topAlert = queue[0];

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      {/* ---- Header：左產品名 + 角色；右目前視角狀態。不放大量 nav ---- */}
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-zinc-50/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-zinc-950 text-white">
              <Compass className="h-4 w-4" />
            </span>
            <div className="leading-tight">
              <div className="text-[15px] font-semibold tracking-tight">WORLDSUN Pipeline</div>
              <div className="text-xs text-zinc-500">
                {profile.full_name ?? profile.email} · {profile.role.toUpperCase()} · 設計方向 B
              </div>
            </div>
          </div>

          {/* segmented nav — 取代 /v2 的 sidebar */}
          <nav className="order-3 flex w-full gap-1.5 overflow-x-auto sm:order-2 sm:w-auto sm:flex-1 sm:justify-center">
            {VIEWS.map((v) => {
              const on = v.key === view;
              return (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => setView(v.key)}
                  className={cn(
                    'group flex items-center gap-2 rounded-lg border px-3 py-1.5 text-left transition-colors',
                    on ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300',
                  )}
                >
                  <v.icon className="h-4 w-4 shrink-0" />
                  <span className="leading-tight">
                    <span className="block text-xs font-semibold">{v.label}</span>
                    <span className={cn('block text-[11px]', on ? 'text-zinc-300' : 'text-zinc-400')}>{v.sub}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="order-2 ml-auto text-right sm:order-3">
            <div className="text-[11px] uppercase tracking-wide text-zinc-400">加權預估</div>
            <div className="text-sm font-semibold tabular-nums">{fmtMoney(Math.round(kpi.weighted))}</div>
          </div>
        </div>

        {/* ---- 常駐風險條：四個視角都看得到「現在哪裡有風險」（可點擊 drill-down） ---- */}
        <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 border-t border-zinc-200 bg-white px-5 py-2">
          <button
            type="button"
            onClick={() => openWar('redflag')}
            className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
          >
            <Flag className="h-3.5 w-3.5" /> 風險 {kpi.flags.length}
          </button>
          <span className="text-zinc-300">·</span>
          <button
            type="button"
            onClick={() => openWar('overdue')}
            className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-semibold text-amber-700 hover:bg-amber-50"
          >
            <Clock className="h-3.5 w-3.5" /> 逾期聯繫 {kpi.overdue.length}
          </button>
          <span className="text-zinc-300">·</span>
          <button
            type="button"
            onClick={() => openWar('today')}
            className="hidden items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-semibold text-sky-700 hover:bg-sky-50 sm:flex"
          >
            <Activity className="h-3.5 w-3.5" /> 待追案件 {queue.length}
          </button>
          {topAlert ? (
            <button
              type="button"
              onClick={() => goToDeal(topAlert.d.id)}
              className="ml-auto flex min-w-0 items-center gap-2 rounded-md px-1.5 py-0.5 text-xs text-zinc-600 hover:bg-zinc-50"
            >
              <span className="hidden text-zinc-400 md:inline">最該處理</span>
              <span className="truncate font-semibold text-zinc-900">{topAlert.d.name}</span>
              <span className="hidden truncate text-rose-600 lg:inline">{topAlert.r?.text}</span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
            </button>
          ) : (
            <span className="ml-auto text-xs font-medium text-emerald-600">目前沒有緊急案件</span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[1320px] px-5 py-5">
        {view === 'cockpit' && (
          <CockpitView
            deals={deals}
            active={active}
            kpi={kpi}
            settings={settings}
            tiers={tiers}
            profiles={profiles}
            nameOfRm={nameOfRm}
            goToDeal={goToDeal}
            openWar={openWar}
          />
        )}
        {view === 'desk' && (
          <DeskView queue={queue} tasks={tasks} deals={deals} nameOfRm={nameOfRm} goToDeal={goToDeal} goTasks={goTasks} />
        )}
        {view === 'war' && (
          <WarView
            deals={deals}
            dealId={dealId}
            setDealId={setDealId}
            settings={settings}
            tiers={tiers}
            painPoints={painPoints}
            marketIntel={marketIntel}
            nameOfRm={nameOfRm}
            warQuick={warQuick}
            setWarQuick={setWarQuick}
          />
        )}
        {view === 'signals' && <SignalsView marketIntel={marketIntel} goToDeal={goToDeal} />}
        {view === 'tasks' && (
          <TaskManagerView tasks={tasks} profiles={profiles} deals={deals} profile={profile} nameOfRm={nameOfRm} goToDeal={goToDeal} />
        )}
      </main>

      <footer className="mx-auto max-w-[1320px] px-5 pb-8 text-xs text-zinc-400">
        設計原型 B · 假資料、不連 Supabase。功能與資料流以正式第一版 Pipeline 為準。
      </footer>
    </div>
  );
}

// ============================================================================
// Kpi shape (shared)
// ============================================================================

interface Kpi {
  pipelineAum: number;
  weighted: number;
  l4ratio: number;
  flags: Deal[];
  overdue: Deal[];
}

type Ranked = { d: Deal; u: number; r: ReturnType<typeof priorityReason> };

// ============================================================================
// Executive Cockpit — 報表式橫向帶狀（不同於 /v2 的卡片網格）
// ============================================================================

function CockpitView({
  deals,
  active,
  kpi,
  settings,
  tiers,
  profiles,
  nameOfRm,
  goToDeal,
  openWar,
}: {
  deals: Deal[];
  active: Deal[];
  kpi: Kpi;
  settings: Settings;
  tiers: Settings['tier_config']['tiers'];
  profiles: Profile[];
  nameOfRm: (id: string) => string;
  goToDeal: (id: string) => void;
  openWar: (q: QuickKey) => void;
}) {
  const total = deals.length || 1;
  const stageDist = STAGES.map((s) => {
    const ds = deals.filter((d) => d.stage === s.id);
    return {
      id: s.id,
      name: s.name,
      count: ds.length,
      aum: ds.reduce((a, d) => a + d.aum_usd, 0),
      prob: settings.stage_probs[s.id] ?? 0,
    };
  });

  const recent = [...deals]
    .filter((d) => d.stage !== 'L7')
    .sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime())
    .slice(0, 4);

  const overdueRows = active
    .map((d) => ({ d, ci: contactOverdue(d, tiers) }))
    .filter((x) => x.ci?.status === 'overdue')
    .sort((a, b) => (b.ci?.deltaDays ?? 0) - (a.ci?.deltaDays ?? 0));

  const teamRows = profiles
    .map((p) => {
      const ds = active.filter((d) => d.rm_id === p.id);
      return {
        p,
        count: ds.length,
        aum: ds.reduce((a, d) => a + d.aum_usd, 0),
        flags: ds.filter((d) => redFlag(d, settings)).length,
      };
    })
    .filter((x) => x.count > 0)
    .sort((a, b) => b.aum - a.aum);

  const metrics: { label: string; value: string; note: string; icon: LucideIcon; t: ToneKey; quick?: QuickKey }[] = [
    { label: 'Pipeline AUM', value: fmtMoney(kpi.pipelineAum), note: `${active.length} 件在途`, icon: Wallet, t: 'zinc', quick: 'all' },
    { label: '加權預估', value: fmtMoney(Math.round(kpi.weighted)), note: '依各階段機率', icon: Gauge, t: 'info' },
    { label: 'L4 以上比例', value: `${kpi.l4ratio}%`, note: '晚期案件佔比', icon: TrendingUp, t: 'accent', quick: 'l4plus' },
    { label: 'Red Flag', value: String(kpi.flags.length), note: '需立即介入', icon: Flag, t: kpi.flags.length ? 'risk' : 'good', quick: 'redflag' },
    { label: '逾期聯繫', value: String(kpi.overdue.length), note: '超過分級週期', icon: Clock, t: kpi.overdue.length ? 'warn' : 'good', quick: 'overdue' },
  ];

  return (
    <div className="space-y-5">
      {/* KPI band — 橫向、密、報表口吻；可點擊 drill-down */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-2 divide-zinc-100 sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
          {metrics.map((m) => {
            const inner = (
              <>
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-zinc-400">
                  <m.icon className={cn('h-3.5 w-3.5', TONE[m.t].text)} />
                  {m.label}
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">{m.value}</div>
                <div className="text-xs text-zinc-500">
                  {m.note}
                  {m.quick ? <span className="ml-1 text-sky-600">· 點擊篩選 ›</span> : null}
                </div>
              </>
            );
            return m.quick ? (
              <button
                key={m.label}
                type="button"
                onClick={() => openWar(m.quick as QuickKey)}
                className="border-b border-zinc-100 px-4 py-3.5 text-left transition-colors last:border-b-0 hover:bg-zinc-50 lg:border-b-0"
              >
                {inner}
              </button>
            ) : (
              <div key={m.label} className="border-b border-zinc-100 px-4 py-3.5 last:border-b-0 lg:border-b-0">
                {inner}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Stage flight path — 單一比例長條 + 明細列（含階段機率） */}
      <Card>
        <PanelHead icon={Route} t="info" q="漏斗分布" hint="案件數比例、各階段機率與案件數" />
        <div className="px-4 py-4">
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
            {stageDist.map((s) =>
              s.count > 0 ? (
                <div
                  key={s.id}
                  className={cn('h-full', TONE[STAGE_TONE[s.id]].solid)}
                  style={{ width: `${(s.count / total) * 100}%` }}
                  title={`${s.id} ${s.name}：${s.count} 件`}
                />
              ) : null,
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4 lg:grid-cols-7">
            {stageDist.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 text-zinc-600">
                  <Dot t={STAGE_TONE[s.id]} />
                  {s.id}
                  <span className="text-zinc-400">機率 {s.prob}%</span>
                </span>
                <span className="tabular-nums font-semibold text-zinc-900">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 最近推進 */}
        <Card>
          <PanelHead icon={TrendingUp} t="good" q="最近推進案件" hint="依最後更新時間" />
          <div className="divide-y divide-zinc-100">
            {recent.length === 0 && <Empty>近期沒有更新</Empty>}
            {recent.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => goToDeal(d.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-zinc-900">{d.name}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
                    <Tag t={STAGE_TONE[d.stage]}>{d.stage}</Tag>
                    <span>{nameOfRm(d.rm_id)}</span>
                    <span className="text-zinc-300">·</span>
                    <span>{daysSince(d.last_updated)} 天前更新</span>
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums text-zinc-900">{fmtMoney(d.aum_usd)}</span>
                <ChevronRight className="h-4 w-4 text-zinc-300" />
              </button>
            ))}
          </div>
        </Card>

        {/* 風險：逾期聯繫 + red flag（顏色分級） */}
        <Card>
          <PanelHead icon={AlertTriangle} t="risk" q="需要介入的風險" hint="逾期聯繫與紅旗案件" />
          <div className="divide-y divide-zinc-100">
            {overdueRows.length === 0 && kpi.flags.length === 0 && <Empty>目前沒有風險案件</Empty>}
            {overdueRows.map(({ d, ci }) => (
              <button
                key={d.id}
                type="button"
                onClick={() => goToDeal(d.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-700">
                  <Clock className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-zinc-900">{d.name}</div>
                  <div className="text-xs font-medium text-amber-700">
                    逾期 {ci?.deltaDays} 天（{d.tier} 級週期 {ci?.interval} 天）
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-300" />
              </button>
            ))}
            {kpi.flags
              .filter((d) => !overdueRows.some((o) => o.d.id === d.id))
              .map((d) => {
                const f = redFlag(d, settings);
                const ft = flagTone(f);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => goToDeal(d.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50"
                  >
                    <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-lg', TONE[ft].soft, TONE[ft].text)}>
                      <Flag className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-zinc-900">{d.name}</div>
                      <div className={cn('text-xs font-medium', TONE[ft].text)}>{f}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-zinc-300" />
                  </button>
                );
              })}
          </div>
        </Card>
      </div>

      {/* Team load board — 一列一人，密 */}
      <Card>
        <PanelHead icon={Users} t="zinc" q="團隊負載" hint="在途 AUM、案件數、紅旗" />
        <div className="divide-y divide-zinc-100">
          {teamRows.map(({ p, count, aum, flags }) => (
            <div key={p.id} className="flex items-center gap-4 px-4 py-3">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">
                  {(p.full_name ?? p.email).slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-zinc-900">{p.full_name ?? p.email}</div>
                  <div className="text-[11px] uppercase tracking-wide text-zinc-400">{p.role}</div>
                </div>
              </div>
              <div className="hidden text-right sm:block">
                <div className="text-[11px] text-zinc-400">案件</div>
                <div className="text-sm font-semibold tabular-nums">{count}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-zinc-400">在途 AUM</div>
                <div className="text-sm font-semibold tabular-nums">{fmtMoney(aum)}</div>
              </div>
              <div className="w-16 text-right">
                {flags > 0 ? <Tag t="risk">{flags} 紅旗</Tag> : <Tag t="good">健康</Tag>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// RM Daily Desk — 固定欄位優先序列（依 urgency 排序，不是建立時間）
// ============================================================================

function DeskView({
  queue,
  tasks,
  deals,
  nameOfRm,
  goToDeal,
  goTasks,
}: {
  queue: Ranked[];
  tasks: Task[];
  deals: Deal[];
  nameOfRm: (id: string) => string;
  goToDeal: (id: string) => void;
  goTasks: () => void;
}) {
  const dealName = (id: string | null) => deals.find((d) => d.id === id)?.name ?? '無關聯案件';
  const buckets: Record<TaskBucket, Task[]> = { late: [], soon: [], later: [], done: [] };
  tasks.forEach((t) => buckets[taskBucket(t)].push(t));

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {/* 今日待追：固定欄位清單 */}
      <div className="lg:col-span-2">
        <Card>
          <PanelHead icon={Zap} t="warn" q="今天最該追的案件" hint={`依緊急度排序，共 ${queue.length} 件`} />
          {/* 欄位表頭（lg 以上才顯示，建立可掃描的固定結構） */}
          <div className="hidden border-b border-zinc-100 bg-zinc-50/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 lg:grid lg:grid-cols-[24px_minmax(0,1.4fr)_minmax(120px,150px)_minmax(0,1.5fr)_140px] lg:items-center lg:gap-x-3">
            <span>#</span>
            <span>客戶／案件</span>
            <span>風險原因</span>
            <span>下一步</span>
            <span className="text-right">操作</span>
          </div>
          <div className="divide-y divide-zinc-100">
            {queue.length === 0 && <Empty>今天沒有需要立即處理的案件</Empty>}
            {queue.map(({ d, r }, i) => {
              const a = actionFor(r?.icon);
              const next = splitNextStepIntoTasks(d.next_step)[0] ?? d.next_step ?? '尚未設定下一步';
              return (
                <div
                  key={d.id}
                  className="grid gap-x-3 gap-y-2 px-4 py-3 lg:grid-cols-[24px_minmax(0,1.4fr)_minmax(120px,150px)_minmax(0,1.5fr)_140px] lg:items-center"
                >
                  {/* # */}
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-zinc-950 text-[11px] font-semibold text-white">
                    {i + 1}
                  </span>
                  {/* 客戶／案件 + AUM + RM + tier/stage */}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[15px] font-semibold text-zinc-900">{d.name}</span>
                      <span className="text-sm font-semibold tabular-nums text-zinc-700">{fmtMoney(d.aum_usd)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                      <Tag t={tierTone(d.tier)}>{d.tier ?? '—'}</Tag>
                      <Tag t={STAGE_TONE[d.stage]}>
                        {d.stage} {STAGE_LABEL[d.stage]}
                      </Tag>
                      <span>{nameOfRm(d.rm_id)}</span>
                    </div>
                  </div>
                  {/* 風險原因 */}
                  <div className={cn('flex items-start gap-1 text-xs font-medium', TONE[a.t].text)}>
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="line-clamp-2">{r?.text}</span>
                  </div>
                  {/* 下一步（單行） */}
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wide text-zinc-400">下一步</div>
                    <div className="flex items-center gap-1 text-xs text-zinc-700">
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-sky-600" />
                      <span className="truncate">{next}</span>
                    </div>
                  </div>
                  {/* 操作 */}
                  <div className="flex flex-col gap-1.5 lg:items-stretch">
                    <button
                      type="button"
                      onClick={() => goToDeal(d.id)}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-xs font-semibold text-white',
                        a.t === 'risk' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-zinc-950 hover:bg-zinc-800',
                      )}
                    >
                      {a.verb}
                    </button>
                    <ContactLog />
                    <button
                      type="button"
                      onClick={() => goToDeal(d.id)}
                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:border-zinc-300"
                    >
                      作戰室
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* 右欄：任務（固定欄位 + 到期分級 badge + 左色條）+ next step 拆解 */}
      <div className="space-y-5">
        <Card>
          <PanelHead icon={ListChecks} t="info" q="待辦任務" hint="依到期狀態分組" />
          <div className="space-y-3 px-4 py-3">
            {(['late', 'soon', 'later'] as const).map((bk) => {
              const list = buckets[bk];
              const meta =
                bk === 'late'
                  ? { label: '已逾期', t: 'risk' as ToneKey }
                  : bk === 'soon'
                    ? { label: '3 天內到期', t: 'warn' as ToneKey }
                    : { label: '之後', t: 'zinc' as ToneKey };
              return (
                <div key={bk}>
                  <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    <Dot t={meta.t} />
                    {meta.label}
                    <span className="tabular-nums">（{list.length}）</span>
                  </div>
                  {list.length === 0 ? (
                    <div className="pl-3.5 text-xs text-zinc-400">無</div>
                  ) : (
                    <ul className="space-y-1.5">
                      {list.map((t) => {
                        const db = dueBadge(t.due_date);
                        return (
                          <li
                            key={t.id}
                            className="overflow-hidden rounded-lg border border-zinc-100 bg-zinc-50/60"
                          >
                            <div className={cn('border-l-[3px] px-2.5 py-2', TONE[meta.t].borderL)}>
                              <div className="flex items-center gap-2">
                                <CalendarClock className={cn('h-3.5 w-3.5 shrink-0', TONE[meta.t].text)} />
                                <span className="flex-1 text-sm font-medium text-zinc-800">{t.title}</span>
                                <span
                                  className={cn(
                                    'shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold',
                                    TONE[db.t].soft,
                                    TONE[db.t].text,
                                  )}
                                >
                                  {db.label}
                                </span>
                              </div>
                              <div className="mt-0.5 pl-5 text-xs text-zinc-500">{dealName(t.deal_id)}</div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
            {/* 完成項收成一行（預設不展開，畫面聚焦在待辦） */}
            {buckets.done.length > 0 ? (
              <div className="flex items-center gap-1.5 border-t border-zinc-100 pt-2 text-xs text-zinc-400">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                已完成 {buckets.done.length} 件（已隱藏，聚焦待辦）
              </div>
            ) : null}
            <button
              type="button"
              onClick={goTasks}
              className="flex w-full items-center justify-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:border-zinc-300"
            >
              看完整任務管理
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </Card>

        {queue[0] ? (
          <Card>
            <PanelHead icon={Sparkles} t="accent" q="下一步自動拆解" hint={queue[0].d.name} />
            <ul className="space-y-1.5 px-4 py-3">
              {splitNextStepIntoTasks(queue[0].d.next_step).map((step, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-zinc-700">
                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border border-zinc-300 text-[10px] text-zinc-400">
                    {idx + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
              {splitNextStepIntoTasks(queue[0].d.next_step).length === 0 && <Empty>尚未設定下一步</Empty>}
            </ul>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

// ============================================================================
// Deal War Room — master-detail；每個 panel 用「問題」當標題
// ============================================================================

function WarView({
  deals,
  dealId,
  setDealId,
  settings,
  tiers,
  painPoints,
  marketIntel,
  nameOfRm,
  warQuick,
  setWarQuick,
}: {
  deals: Deal[];
  dealId: string | null;
  setDealId: (id: string) => void;
  settings: Settings;
  tiers: Settings['tier_config']['tiers'];
  painPoints: PainPoint[];
  marketIntel: MarketIntel[];
  nameOfRm: (id: string) => string;
  warQuick: QuickKey;
  setWarQuick: (q: QuickKey) => void;
}) {
  const [q, setQ] = useState('');
  const [stageF, setStageF] = useState<StageId | 'ALL'>('ALL');

  const list = deals
    .filter(
      (d) =>
        matchQuick(d, warQuick, settings, tiers) &&
        (stageF === 'ALL' || d.stage === stageF) &&
        (q.trim() === '' || d.name.includes(q.trim()) || (d.product ?? '').includes(q.trim())),
    )
    .sort((a, b) => stageIdx(b.stage) - stageIdx(a.stage) || b.aum_usd - a.aum_usd);

  const selected = deals.find((d) => d.id === dealId) ?? list[0] ?? deals[0];

  const stageChips: (StageId | 'ALL')[] = ['ALL', ...STAGES.map((s) => s.id)];

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      {/* 左：案件清單 + quick filters + stage 篩選 */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜尋客戶、案件、商品"
            className="h-10 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400"
          />
        </div>

        {/* ③ RM quick filters（最高權重，第一排） */}
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            <Filter className="h-3.5 w-3.5" /> 常用篩選
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_FILTERS.map((f) => {
              const on = warQuick === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setWarQuick(f.key)}
                  className={cn(
                    'rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                    on ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300',
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* stage 篩選（次要） */}
        <div className="flex flex-wrap gap-1.5">
          {stageChips.map((s) => {
            const on = stageF === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStageF(s)}
                className={cn(
                  'rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
                  on ? 'border-zinc-700 bg-zinc-100 text-zinc-900' : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300',
                )}
              >
                {s === 'ALL' ? '全部階段' : s}
              </button>
            );
          })}
        </div>

        {/* 結果數 + 已套用篩選 chip（可一鍵清除） */}
        <div className="flex items-center justify-between px-1 text-xs text-zinc-500">
          <span>
            共 <span className="font-semibold text-zinc-900 tabular-nums">{list.length}</span> 件
          </span>
          {warQuick !== 'all' ? (
            <button
              type="button"
              onClick={() => setWarQuick('all')}
              className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-zinc-600 hover:border-zinc-300"
            >
              {QUICK_LABEL[warQuick]}
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>

        <Card className="overflow-hidden">
          <div className="max-h-[68vh] divide-y divide-zinc-100 overflow-y-auto">
            {list.length === 0 && <Empty>沒有符合的案件</Empty>}
            {list.map((d) => {
              const on = selected && d.id === selected.id;
              const f = redFlag(d, settings);
              const ft = flagTone(f);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDealId(d.id)}
                  className={cn('block w-full px-3.5 py-3 text-left', on ? 'bg-zinc-950 text-white' : 'hover:bg-zinc-50')}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn('truncate text-sm font-semibold', on ? 'text-white' : 'text-zinc-900')}>{d.name}</span>
                    {f ? <Flag className={cn('h-3 w-3 shrink-0', on ? 'text-rose-300' : TONE[ft].text)} /> : null}
                  </div>
                  <div className={cn('mt-1 flex items-center gap-2 text-xs', on ? 'text-zinc-300' : 'text-zinc-500')}>
                    <span>{d.stage}</span>
                    <span className={on ? 'text-zinc-500' : 'text-zinc-300'}>·</span>
                    <span>{d.tier ?? '—'} 級</span>
                    <span className="ml-auto font-semibold tabular-nums">{fmtMoney(d.aum_usd)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      {/* 右：問題導向 panels */}
      {selected ? (
        <WarRoomDetail
          deal={selected}
          settings={settings}
          tiers={tiers}
          painPoints={painPoints}
          marketIntel={marketIntel}
          nameOfRm={nameOfRm}
        />
      ) : (
        <Card>
          <Empty>請從左側選一個案件</Empty>
        </Card>
      )}
    </div>
  );
}

function WarRoomDetail({
  deal,
  settings,
  tiers,
  painPoints,
  marketIntel,
  nameOfRm,
}: {
  deal: Deal;
  settings: Settings;
  tiers: Settings['tier_config']['tiers'];
  painPoints: PainPoint[];
  marketIntel: MarketIntel[];
  nameOfRm: (id: string) => string;
}) {
  const flag = redFlag(deal, settings);
  const ft = flagTone(flag);
  const ci = contactOverdue(deal, tiers);
  const score = totalScore(deal);
  const steps = deal.plan?.steps ?? [];
  const notes = deal.score_notes ?? [];
  const comments = (deal.comments ?? []).slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const linkedSignals = marketIntel.filter((mi) => mi.deal_links?.some((l) => l.deal_id === deal.id));
  const nextItems = splitNextStepIntoTasks(deal.next_step);

  const decisionKeys: { key: 'e' | 'c1' | 'd2' | 'p'; label: string; icon: LucideIcon }[] = [
    { key: 'e', label: 'Economic Buyer 拍板者', icon: Crown },
    { key: 'c1', label: 'Champion 內部倡議者', icon: Users },
    { key: 'd2', label: 'Decision Process 決策流程', icon: Route },
    { key: 'p', label: 'Paper Process 文件流程', icon: FileText },
  ];

  return (
    <div className="space-y-5">
      {/* 案件抬頭 */}
      <Card>
        <div className="flex flex-wrap items-start gap-x-6 gap-y-3 px-4 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight text-zinc-950">{deal.name}</h2>
              <Tag t={tierTone(deal.tier)}>{deal.tier ?? '—'} 級</Tag>
              <Tag t={STAGE_TONE[deal.stage]}>
                {deal.stage} {STAGE_LABEL[deal.stage]} · 機率 {settings.stage_probs[deal.stage] ?? 0}%
              </Tag>
            </div>
            <div className="mt-1 text-sm text-zinc-500">{deal.product ?? '尚未設定商品'}</div>
          </div>
          <div className="flex gap-6 text-sm">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-zinc-400">AUM</div>
              <div className="text-base font-semibold tabular-nums">{fmtMoney(deal.aum_usd)}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-zinc-400">負責 RM</div>
              <div className="font-medium">{nameOfRm(deal.rm_id)}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-zinc-400">目標成交</div>
              <div className="font-medium tabular-nums">{fmtMD(deal.target_close_date)}</div>
            </div>
          </div>
        </div>
        {flag || ci?.status === 'overdue' ? (
          <div className="flex flex-wrap gap-2 border-t border-zinc-100 px-4 py-2.5">
            {flag ? (
              <span className={cn('flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold', TONE[ft].soft, TONE[ft].text)}>
                <Flag className="h-3.5 w-3.5" /> {flag}
              </span>
            ) : null}
            {ci?.status === 'overdue' ? (
              <span className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                <Clock className="h-3.5 w-3.5" /> 逾期聯繫 {ci.deltaDays} 天
              </span>
            ) : null}
          </div>
        ) : null}
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Q1：為什麼這案子卡住 */}
        <Card>
          <PanelHead icon={Gauge} t="risk" q="為什麼這案子卡住？" hint={`MEDDPICC 總分 ${score} / 80`} />
          <div className="space-y-2 px-4 py-3">
            {MEDDIC.map((m) => {
              const v = deal.scores?.[m.key] ?? 0;
              const weak = v < 5;
              const note = notes.find((n) => n.field === m.key);
              return (
                <div key={m.key} className="rounded-lg border border-zinc-100 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-800">{m.label}</span>
                    <span className={cn('ml-auto text-sm font-semibold tabular-nums', weak ? 'text-rose-600' : 'text-emerald-600')}>
                      {v}/10
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                    <div className={cn('h-full rounded-full', weak ? 'bg-rose-500' : 'bg-emerald-500')} style={{ width: `${v * 10}%` }} />
                  </div>
                  {note ? (
                    <div className="mt-1.5 text-xs text-zinc-500">
                      <span className="text-zinc-400">證據：</span>
                      {note.evidence}
                    </div>
                  ) : weak ? (
                    <div className="mt-1.5 text-xs text-rose-500">弱項，需要補強證據</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Q2：下一步做什麼 */}
        <Card>
          <PanelHead icon={Target} t="info" q="下一步做什麼？" hint="next step 拆解 + AI 路徑步驟" />
          <div className="space-y-4 px-4 py-3">
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">立即拆解</div>
              {nextItems.length === 0 ? (
                <div className="text-sm text-zinc-400">尚未設定下一步</div>
              ) : (
                <ul className="space-y-1.5">
                  {nextItems.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 rounded-lg bg-sky-50/60 px-2.5 py-2 text-sm text-zinc-700">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {steps.length > 0 ? (
              <div>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">AI 路徑步驟</div>
                <ol className="space-y-2">
                  {steps.map((st) => (
                    <li key={st.id} className="rounded-lg border border-zinc-100 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className={cn('h-2 w-2 rounded-full', st.completed ? 'bg-emerald-500' : 'bg-zinc-300')} />
                        <span className="text-sm font-semibold text-zinc-800">{st.title}</span>
                        <span className="ml-auto text-[11px] tabular-nums text-zinc-400">{fmtMD(st.target_date)}</span>
                      </div>
                      {st.talking_points.length > 0 ? (
                        <div className="mt-1 pl-4 text-xs text-zinc-500">{st.talking_points[0]}</div>
                      ) : null}
                      {st.risks.length > 0 ? (
                        <div className="mt-0.5 pl-4 text-xs text-rose-500">風險：{st.risks[0]}</div>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-zinc-200 px-3 py-2 text-xs text-zinc-400">
                尚未產生 AI 成交路徑
              </div>
            )}
          </div>
        </Card>

        {/* Q3：誰是拍板者 / 文件到哪 */}
        <Card>
          <PanelHead icon={Crown} t="accent" q="誰是拍板者、文件到哪？" hint="決策路徑與 Paper Process" />
          <div className="grid grid-cols-2 gap-3 px-4 py-3">
            {decisionKeys.map((dk) => {
              const v = deal.scores?.[dk.key] ?? 0;
              const t: ToneKey = v >= 6 ? 'good' : v >= 3 ? 'warn' : 'risk';
              return (
                <div key={dk.key} className={cn('rounded-lg border px-3 py-2.5', TONE[t].ring, TONE[t].soft)}>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-600">
                    <dk.icon className={cn('h-3.5 w-3.5', TONE[t].text)} />
                    {dk.label}
                  </div>
                  <div className={cn('mt-1 text-xl font-semibold tabular-nums', TONE[t].text)}>{v}/10</div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Q4：談過什麼 */}
        <Card>
          <PanelHead icon={MessageSquare} t="zinc" q="談過什麼？" hint="互動與對話記錄" />
          <div className="divide-y divide-zinc-100">
            {comments.length === 0 && <Empty>還沒有對話記錄</Empty>}
            {comments.map((c) => (
              <div key={c.id} className="px-4 py-3">
                <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                  <span>{nameOfRm(c.author_id ?? '')}</span>
                  <span>·</span>
                  <span className="tabular-nums">{fmtMD(c.created_at)}</span>
                </div>
                <div className="mt-1 text-sm text-zinc-700">{c.body}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Q5：彈藥庫 — 連動市場訊號 + 痛點對應商品 */}
      <Card>
        <PanelHead icon={Newspaper} t="info" q="這案子的彈藥在哪？" hint="連動市場訊號與痛點→商品" />
        <div className="grid gap-4 px-4 py-3 lg:grid-cols-2">
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">連動市場訊號</div>
            {linkedSignals.length === 0 ? (
              <div className="text-sm text-zinc-400">沒有連動的市場訊號</div>
            ) : (
              <ul className="space-y-2">
                {linkedSignals.map((mi) => (
                  <li key={mi.id} className="rounded-lg border border-zinc-100 px-3 py-2">
                    <div className="text-sm font-medium text-zinc-800">{mi.title}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {mi.deal_links?.find((l) => l.deal_id === deal.id)?.relevance_reason}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">痛點對應商品</div>
            <ul className="space-y-2">
              {painPoints
                .filter((p) => p.is_active)
                .map((p) => {
                  const hit = deal.tier ? p.tiers.includes(deal.tier) : false;
                  return (
                    <li
                      key={p.id}
                      className={cn('rounded-lg border px-3 py-2', hit ? 'border-violet-200 bg-violet-50/60' : 'border-zinc-100')}
                    >
                      <div className="flex items-center gap-2 text-sm font-medium text-zinc-800">
                        {p.pain}
                        {hit ? <Tag t="accent">符合 {deal.tier}</Tag> : null}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500">
                        {p.product} — {p.pitch}
                      </div>
                    </li>
                  );
                })}
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// Market Signals — 彈藥卡，連回客戶
// ============================================================================

function SignalsView({ marketIntel, goToDeal }: { marketIntel: MarketIntel[]; goToDeal: (id: string) => void }) {
  const stanceTone: Record<string, { t: ToneKey; label: string }> = {
    bullish: { t: 'good', label: '偏多' },
    bearish: { t: 'risk', label: '偏空' },
    neutral: { t: 'zinc', label: '中性' },
    na: { t: 'zinc', label: '無方向' },
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {marketIntel.length === 0 && (
        <Card>
          <Empty>目前沒有市場訊號</Empty>
        </Card>
      )}
      {marketIntel.map((mi) => {
        const st = stanceTone[mi.stance] ?? stanceTone.na;
        return (
          <Card key={mi.id} className="flex flex-col">
            <div className="border-b border-zinc-100 px-4 py-3">
              <div className="flex items-start gap-2">
                <h3 className="flex-1 text-[15px] font-semibold leading-snug text-zinc-950">{mi.title}</h3>
                <Tag t={st.t}>{st.label}</Tag>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Tag t="info">{mi.region}</Tag>
                {(mi.tags ?? []).map((tg) => (
                  <Tag key={tg.id}>{tg.name}</Tag>
                ))}
                <span className="ml-auto text-[11px] text-zinc-400">{fmtMD(mi.published_at)}</span>
              </div>
            </div>
            <div className="flex-1 px-4 py-3">
              <p className="text-sm leading-relaxed text-zinc-600">{mi.summary}</p>
              {mi.key_points.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {mi.key_points.map((kp, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-zinc-500">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-400" />
                      {kp}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {mi.deal_links && mi.deal_links.length > 0 ? (
              <div className="border-t border-zinc-100 px-4 py-2.5">
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">可推進客戶</div>
                <div className="flex flex-wrap gap-1.5">
                  {mi.deal_links.map((l) => (
                    <button
                      key={l.deal_id}
                      type="button"
                      onClick={() => goToDeal(l.deal_id)}
                      className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-950 hover:bg-zinc-950 hover:text-white"
                    >
                      {l.deal?.name ?? l.deal_id}
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================================
// Task Manager — 第五視角：全團隊任務總表（依舊版 GPT 截圖1 建議）
//   統計卡可篩選 · 依指派人分組 · 固定欄位 · 到期分級 badge + 左色條
//   隱藏完成（收一行可展開）· 排序 逾期→今天→本週→其他
//   狀態切換 / 刪除 / 新增 = 視覺互動示範（本地 state，不接 Supabase）
// ============================================================================

type TStatus = 'todo' | 'doing' | 'done';
type TQuick = 'all' | 'overdue' | 'today' | 'week' | 'mine' | 'high';

function TaskManagerView({
  tasks,
  profiles,
  deals,
  profile,
  nameOfRm,
  goToDeal,
}: {
  tasks: Task[];
  profiles: Profile[];
  deals: Deal[];
  profile: Profile;
  nameOfRm: (id: string) => string;
  goToDeal: (id: string) => void;
}) {
  const [ov, setOv] = useState<Record<string, TStatus>>({});
  const [removed, setRemoved] = useState<Record<string, true>>({});
  const [query, setQuery] = useState('');
  const [quick, setQuick] = useState<TQuick>('all');
  const [grouped, setGrouped] = useState(true);
  const [showDone, setShowDone] = useState(false);
  const [addNote, setAddNote] = useState(false);

  const dealName = (id: string | null) => deals.find((d) => d.id === id)?.name ?? '無關聯案件';
  const statusOf = (t: Task): TStatus => ov[t.id] ?? t.status;
  const dueDays = (t: Task): number | null => {
    if (!t.due_date) return null;
    const d = new Date(`${t.due_date}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((d.getTime() - today.getTime()) / 86_400_000);
  };
  const bucketOf = (t: Task): TaskBucket => {
    if (statusOf(t) === 'done') return 'done';
    const dd = dueDays(t);
    if (dd === null) return 'later';
    if (dd < 0) return 'late';
    if (dd <= 3) return 'soon';
    return 'later';
  };

  const live = tasks.filter((t) => !removed[t.id]);
  const cntOpen = live.filter((t) => statusOf(t) !== 'done').length;
  const cntOverdue = live.filter((t) => bucketOf(t) === 'late').length;
  const cntToday = live.filter((t) => dueDays(t) === 0 && statusOf(t) !== 'done').length;
  const cntWeek = live.filter((t) => {
    const dd = dueDays(t);
    return dd !== null && dd >= 0 && dd <= 7 && statusOf(t) !== 'done';
  }).length;
  const cntMine = live.filter((t) => t.assignee_id === profile.id && statusOf(t) !== 'done').length;
  const cntHigh = live.filter((t) => t.priority === 'high' && statusOf(t) !== 'done').length;

  const stats: { label: string; value: number; icon: LucideIcon; t: ToneKey; quick: TQuick }[] = [
    { label: '未完成', value: cntOpen, icon: ClipboardList, t: 'zinc', quick: 'all' },
    { label: '已逾期', value: cntOverdue, icon: AlertTriangle, t: cntOverdue ? 'risk' : 'good', quick: 'overdue' },
    { label: '本週到期', value: cntWeek, icon: CalendarClock, t: cntWeek ? 'warn' : 'good', quick: 'week' },
    { label: '我被指派', value: cntMine, icon: Users, t: 'info', quick: 'mine' },
  ];
  const quicks: { key: TQuick; label: string; n: number }[] = [
    { key: 'all', label: '全部', n: cntOpen },
    { key: 'overdue', label: '逾期', n: cntOverdue },
    { key: 'today', label: '今天', n: cntToday },
    { key: 'week', label: '本週', n: cntWeek },
    { key: 'mine', label: '我的', n: cntMine },
    { key: 'high', label: '高優先', n: cntHigh },
  ];

  const matchQ = (t: Task): boolean => {
    if (query.trim()) {
      const qq = query.trim();
      if (!(t.title.includes(qq) || dealName(t.deal_id).includes(qq))) return false;
    }
    switch (quick) {
      case 'overdue':
        return bucketOf(t) === 'late';
      case 'today':
        return dueDays(t) === 0 && statusOf(t) !== 'done';
      case 'week': {
        const dd = dueDays(t);
        return dd !== null && dd >= 0 && dd <= 7 && statusOf(t) !== 'done';
      }
      case 'mine':
        return t.assignee_id === profile.id;
      case 'high':
        return t.priority === 'high';
      default:
        return true;
    }
  };

  const ORDER: Record<TaskBucket, number> = { late: 0, soon: 1, later: 2, done: 3 };
  const prRank = (p: Task['priority']) => (p === 'high' ? 2 : p === 'normal' ? 1 : 0);

  const activeList = live
    .filter((t) => statusOf(t) !== 'done' && matchQ(t))
    .sort(
      (a, b) =>
        ORDER[bucketOf(a)] - ORDER[bucketOf(b)] ||
        (dueDays(a) ?? 1e9) - (dueDays(b) ?? 1e9) ||
        prRank(b.priority) - prRank(a.priority),
    );
  const doneList = live.filter((t) => statusOf(t) === 'done');

  const priMeta: Record<Task['priority'], { label: string; t: ToneKey }> = {
    high: { label: '高', t: 'risk' },
    normal: { label: '一般', t: 'zinc' },
    low: { label: '低', t: 'zinc' },
  };
  const stMeta: Record<TStatus, { label: string; t: ToneKey }> = {
    todo: { label: '待處理', t: 'zinc' },
    doing: { label: '進行中', t: 'info' },
    done: { label: '完成', t: 'good' },
  };
  const nextStatus: Record<TStatus, TStatus> = { todo: 'doing', doing: 'done', done: 'todo' };

  const groups: { p: Profile | null; items: Task[] }[] = grouped
    ? profiles
        .map((p) => ({ p: p as Profile | null, items: activeList.filter((t) => t.assignee_id === p.id) }))
        .filter((g) => g.items.length > 0)
    : [{ p: null, items: activeList }];
  const orphan = grouped ? activeList.filter((t) => !profiles.some((p) => p.id === t.assignee_id)) : [];

  const renderRow = (t: Task): ReactNode => {
    const s = statusOf(t);
    const bk = bucketOf(t);
    const bkTone: ToneKey = bk === 'late' ? 'risk' : bk === 'soon' ? 'warn' : bk === 'done' ? 'good' : 'zinc';
    const db = dueBadge(t.due_date);
    const StatusIcon = s === 'done' ? CheckCircle2 : s === 'doing' ? Clock : Circle;
    return (
      <div key={t.id} className="group">
        <div
          className={cn(
            'grid items-center gap-x-3 gap-y-1.5 border-l-[3px] px-4 py-2.5 lg:grid-cols-[24px_minmax(0,1.7fr)_112px_60px_84px_28px]',
            TONE[bkTone].borderL,
            s === 'done' && 'opacity-60',
          )}
        >
          <button
            type="button"
            onClick={() => setOv((m) => ({ ...m, [t.id]: nextStatus[s] }))}
            title="點擊切換狀態（示範）"
            className={cn('grid h-5 w-5 place-items-center rounded-full', TONE[stMeta[s].t].text)}
          >
            <StatusIcon className="h-[18px] w-[18px]" />
          </button>
          <div className="min-w-0">
            <div className={cn('text-sm font-semibold text-zinc-900', s === 'done' && 'line-through')}>{t.title}</div>
            <button
              type="button"
              onClick={() => t.deal_id && goToDeal(t.deal_id)}
              className="mt-0.5 block max-w-full truncate text-left text-xs text-zinc-500 hover:text-zinc-900"
            >
              {dealName(t.deal_id)}
            </button>
          </div>
          <span className={cn('justify-self-start rounded px-1.5 py-0.5 text-[11px] font-semibold', TONE[db.t].soft, TONE[db.t].text)}>
            {db.label}
          </span>
          <span
            className={cn(
              'justify-self-start rounded px-1.5 py-0.5 text-[11px] font-semibold',
              TONE[priMeta[t.priority].t].soft,
              TONE[priMeta[t.priority].t].text,
            )}
          >
            {priMeta[t.priority].label}
          </span>
          <span className={cn('inline-flex items-center gap-1 justify-self-start text-xs font-medium', TONE[stMeta[s].t].text)}>
            <Dot t={stMeta[s].t} />
            {stMeta[s].label}
          </span>
          <button
            type="button"
            onClick={() => setRemoved((m) => ({ ...m, [t.id]: true }))}
            title="刪除（示範）"
            className="justify-self-end text-zinc-300 opacity-0 transition-opacity hover:text-rose-600 group-hover:opacity-100"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* 統計卡（可點擊篩選） */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-2 divide-zinc-100 lg:grid-cols-4 lg:divide-x">
          {stats.map((m) => (
            <button
              key={m.label}
              type="button"
              onClick={() => setQuick(m.quick)}
              className={cn(
                'border-b border-zinc-100 px-4 py-3.5 text-left transition-colors hover:bg-zinc-50 lg:border-b-0',
                quick === m.quick && 'bg-zinc-50',
              )}
            >
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-zinc-400">
                <m.icon className={cn('h-3.5 w-3.5', TONE[m.t].text)} />
                {m.label}
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{m.value}</div>
              <div className="text-xs text-sky-600">點擊篩選 ›</div>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        {/* 工具列：搜尋優先且寬 + 分組 + 新增任務 */}
        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 px-4 py-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜尋客戶、案件、任務內容"
              className="h-9 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400"
            />
          </div>
          <button
            type="button"
            onClick={() => setGrouped((v) => !v)}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:border-zinc-300"
          >
            {grouped ? '分組：依指派人' : '分組：關閉'}
          </button>
          <button
            type="button"
            onClick={() => setAddNote((v) => !v)}
            className="flex items-center gap-1 rounded-lg bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
          >
            <Plus className="h-3.5 w-3.5" /> 新增任務
          </button>
        </div>

        {/* quick filter pills（含計數） */}
        <div className="flex flex-wrap gap-1.5 border-b border-zinc-100 px-4 py-2.5">
          {quicks.map((f) => {
            const on = quick === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setQuick(f.key)}
                className={cn(
                  'flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                  on ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300',
                )}
              >
                {f.label}
                <span className={cn('tabular-nums', on ? 'text-zinc-300' : 'text-zinc-400')}>{f.n}</span>
              </button>
            );
          })}
        </div>

        {addNote ? (
          <div className="border-b border-zinc-100 bg-sky-50/60 px-4 py-2 text-xs text-sky-700">
            原型示範：正式版「新增任務」會開表單並寫入 Supabase；此頁聚焦版面與互動，故不接後端。
          </div>
        ) : null}

        {/* 欄位表頭（lg 才顯示，建立可掃描固定結構） */}
        <div className="hidden border-b border-zinc-100 bg-zinc-50/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 lg:grid lg:grid-cols-[24px_minmax(0,1.7fr)_112px_60px_84px_28px] lg:items-center lg:gap-x-3">
          <span>狀態</span>
          <span>任務／客戶</span>
          <span>到期</span>
          <span>優先</span>
          <span>進度</span>
          <span />
        </div>

        {activeList.length === 0 ? (
          <Empty>沒有符合的任務</Empty>
        ) : grouped ? (
          <div>
            {groups.map((g) => (
              <div key={g.p?.id ?? 'none'}>
                <div className="flex items-center gap-2.5 bg-zinc-50/80 px-4 py-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-600">
                    {(g.p?.full_name ?? g.p?.email ?? '?').slice(0, 1)}
                  </span>
                  <span className="text-sm font-semibold text-zinc-900">{g.p ? nameOfRm(g.p.id) : '未指派'}</span>
                  {g.p ? <span className="text-[11px] uppercase tracking-wide text-zinc-400">{g.p.role}</span> : null}
                  <span className="ml-auto text-xs tabular-nums text-zinc-500">{g.items.length} 件</span>
                </div>
                <div className="divide-y divide-zinc-100">{g.items.map((t) => renderRow(t))}</div>
              </div>
            ))}
            {orphan.length > 0 ? (
              <div>
                <div className="bg-zinc-50/80 px-4 py-2 text-sm font-semibold text-zinc-900">未指派</div>
                <div className="divide-y divide-zinc-100">{orphan.map((t) => renderRow(t))}</div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">{activeList.map((t) => renderRow(t))}</div>
        )}

        {/* 完成項預設收一行，可展開 */}
        {doneList.length > 0 ? (
          <div className="border-t border-zinc-100">
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              className="flex w-full items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-zinc-500 hover:bg-zinc-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              已完成 {doneList.length} 件
              <ChevronDown className={cn('ml-1 h-3.5 w-3.5 transition-transform', showDone && 'rotate-180')} />
            </button>
            {showDone ? <div className="divide-y divide-zinc-100">{doneList.map((t) => renderRow(t))}</div> : null}
          </div>
        ) : null}
      </Card>

      <div className="text-xs text-zinc-400">
        狀態切換、刪除、新增為原型互動示範（本地 state，不接 Supabase）；資料流與權限以正式第一版 Pipeline 為準。
      </div>
    </div>
  );
}
