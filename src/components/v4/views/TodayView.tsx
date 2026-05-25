'use client';

// ============================================================
// 今日 view — v4.2 tab 切換版
// ============================================================
// 之前:今日追蹤清單 + 我的任務 上下並列,版面過長
// 現在:頂部 2 顆 tab 切換,一次只顯示一個區塊
//   - 「今日追蹤(N)」  → 優先客戶列表
//   - 「我的任務(M)」  → TaskRow + TaskComposer
// ============================================================
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ClipboardList, Phone, Target } from 'lucide-react';
import type { Snapshot, Task } from '@/lib/v4/types';
import { cn, fmtMoney, priorityReason, TIER_STYLES, totalScore, urgencyScore } from '@/lib/v4/utils';
import { TaskRow, TaskComposer } from '@/components/v4/TaskRow';
import { RealtimeRefresher } from '@/components/v4/RealtimeRefresher';
import { MeddpiccTab } from '@/components/v4/views/MeddpiccTab';

type Tab = 'priority' | 'tasks' | 'meddpicc';

export function TodayView({ snapshot, base }: { snapshot: Snapshot; base: '/workspace' | '/hub' }) {
  const isFixtures = snapshot.source === 'fixtures';
  const priorityDeals = snapshot.deals
    .map((d) => ({ deal: d, score: urgencyScore(d, snapshot.tierConfig) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.deal);

  const today = new Date().toLocaleDateString('zh-Hant-TW', { month: 'long', day: 'numeric', weekday: 'long' });

  // ★ 樂觀本地 task list:server snapshot 是初始值,使用者新增 / 勾完成 / 改優先級 / 刪除
  //   都在這個 state 直接改,UI 立刻反應。server 寫入由 TaskRow / TaskComposer 背景跑。
  const [tasksLocal, setTasksLocal] = useState<Task[]>(snapshot.tasks);
  useEffect(() => { setTasksLocal(snapshot.tasks); }, [snapshot.tasks]);

  const myTasks = tasksLocal.filter((t) => t.status !== 'done');

  // MEDDPICC 補強名單:活躍案件中總分 < 40 (跟紅旗門檻一致) 算「需要補強」
  const meddpiccNeedsWork = snapshot.deals.filter((d) => d.stage !== 'L7' && totalScore(d) < 40).length;

  // 預設選「有東西看」的 tab — 有優先客戶就先看追蹤,沒就跳任務
  const [tab, setTab] = useState<Tab>(priorityDeals.length > 0 ? 'priority' : 'tasks');

  function handleCreated(task: Task) {
    setTasksLocal((prev) => [task, ...prev]);
  }
  function handlePatch(taskId: string, patch: Partial<Task>) {
    setTasksLocal((prev) => prev.map((t) => t.id === taskId ? { ...t, ...patch } : t));
  }
  function handleDelete(taskId: string) {
    setTasksLocal((prev) => prev.filter((t) => t.id !== taskId));
  }
  // DB 寫入回來:把 tmp id 換成真 id(讓後續 toggle/delete 用真 id)
  function handleIdResolved(tmpId: string, realId: string) {
    setTasksLocal((prev) => prev.map((t) => t.id === tmpId ? { ...t, id: realId } : t));
  }

  return (
    <div className="grid gap-8 px-4 py-6 sm:px-8 sm:py-10 lg:px-14 lg:py-14">
      <RealtimeRefresher isFixtures={isFixtures} tables={['deals', 'tasks', 'comments']} />

      <header className="grid gap-2">
        <div className="label-caps text-ink/45">Today · {today}</div>
        <h1 className="font-v4-serif text-[44px] font-medium leading-[1.05] tracking-tight text-ink lg:text-[56px]">
          今天要做的事
        </h1>
        <p className="max-w-2xl text-base leading-7 text-ink/65">
          {priorityDeals.length > 0
            ? `${priorityDeals.length} 個客戶需要關注 · ${myTasks.length} 個未完成任務`
            : '所有客戶都健康。今天可以選擇主動轉介或精進案件品質。'}
        </p>
      </header>

      {/* Tab 切換 */}
      <div className="grid grid-cols-3 gap-2 rounded-md border border-ink/10 bg-paper p-1 max-w-2xl">
        <TabButton
          active={tab === 'priority'}
          onClick={() => setTab('priority')}
          icon={Phone}
          label="今日追蹤"
          count={priorityDeals.length}
          tone={priorityDeals.length > 0 ? 'claret' : 'forest'}
        />
        <TabButton
          active={tab === 'tasks'}
          onClick={() => setTab('tasks')}
          icon={ClipboardList}
          label="我的任務"
          count={myTasks.length}
          tone="cobalt"
        />
        <TabButton
          active={tab === 'meddpicc'}
          onClick={() => setTab('meddpicc')}
          icon={Target}
          label="MEDDPICC"
          count={meddpiccNeedsWork}
          tone="brass"
        />
      </div>

      {tab === 'priority' && <PriorityList deals={priorityDeals} snapshot={snapshot} base={base} />}
      {tab === 'tasks' && (
        <TasksList
          tasks={myTasks}
          snapshot={snapshot}
          base={base}
          isFixtures={isFixtures}
          onCreated={handleCreated}
          onPatch={handlePatch}
          onDelete={handleDelete}
          onIdResolved={handleIdResolved}
        />
      )}
      {tab === 'meddpicc' && <MeddpiccTab snapshot={snapshot} />}
    </div>
  );
}

// ============================================================
// 子元件
// ============================================================
function TabButton({
  active, onClick, icon: Icon, label, count, tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  count: number;
  tone: 'claret' | 'forest' | 'cobalt' | 'brass';
}) {
  const countTone = count === 0
    ? 'bg-ink/10 text-ink/45'
    : tone === 'claret' ? 'bg-claret/15 text-claret'
    : tone === 'forest' ? 'bg-forest/15 text-forest'
    : tone === 'brass' ? 'bg-brass/15 text-brass'
    : 'bg-cobalt/15 text-cobalt';
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-sm px-3 py-2 text-left transition',
        active
          ? 'bg-ink text-paper'
          : 'text-ink/70 hover:bg-cream/60',
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} />
      <span className="text-sm font-semibold">{label}</span>
      <span className={cn(
        'rounded-full px-2 py-0.5 font-v4-mono text-[10px] font-bold numeric',
        active ? 'bg-paper/20 text-paper' : countTone,
      )}>{count}</span>
    </button>
  );
}

function PriorityList({
  deals, snapshot, base,
}: {
  deals: Snapshot['deals'];
  snapshot: Snapshot;
  base: '/workspace' | '/hub';
}) {
  return (
    <section className="grid gap-4">
      <div className="label-caps text-ink/55">優先客戶 · {deals.length} 位 · 按急迫度排序</div>
      {deals.length === 0 ? (
        <div className="rounded-md border border-forest/30 bg-forest/5 px-6 py-12 text-center text-sm font-semibold text-forest">
          🎉 沒有待追蹤的案件,全部健康。
        </div>
      ) : (
        <ul className="grid gap-2">
          {deals.map((d) => {
            const reason = priorityReason(d, snapshot.tierConfig);
            const tone = reason?.tone ?? 'amber';
            const accent = tone === 'rose' ? 'border-l-claret bg-claret/4'
              : tone === 'orange' ? 'border-l-brass bg-brass/4'
              : 'border-l-ink/30 bg-cream/40';
            return (
              <li key={d.id}>
                <Link
                  href={`${base}/clients/${d.id}` as never}
                  className={cn(
                    'group grid grid-cols-[60px_1fr_auto] items-center gap-4 rounded-md border border-ink/10 border-l-4 p-4 transition hover:border-ink/30 hover:shadow-panel',
                    accent,
                  )}
                >
                  <div className="flex flex-col items-center gap-1">
                    {d.tier && (
                      <span className={`rounded-sm px-1.5 py-0.5 font-v4-mono text-[10px] font-bold ${TIER_STYLES[d.tier]}`}>{d.tier}</span>
                    )}
                    <span className={`stage-${d.stage} rounded-sm px-1.5 py-0.5 font-v4-mono text-[10px] font-bold`}>{d.stage}</span>
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
                    {reason && (
                      <div className="mt-1.5 text-sm font-semibold text-ink/85">
                        {reason.icon} {reason.text}
                      </div>
                    )}
                    {d.next_step && (
                      <div className="mt-1 line-clamp-1 text-xs text-ink/55">👉 {d.next_step}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-v4-mono text-base font-semibold text-ink numeric">{fmtMoney(Number(d.aum_usd))}</span>
                    <ArrowUpRight className="h-4 w-4 text-ink/30 transition group-hover:text-ink" strokeWidth={1.75} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function TasksList({
  tasks, snapshot, base, isFixtures, onCreated, onPatch, onDelete, onIdResolved,
}: {
  tasks: Task[];
  snapshot: Snapshot;
  base: '/workspace' | '/hub';
  isFixtures: boolean;
  onCreated: (task: Task) => void;
  onPatch: (taskId: string, patch: Partial<Task>) => void;
  onDelete: (taskId: string) => void;
  onIdResolved: (tmpId: string, realId: string) => void;
}) {
  return (
    <section className="grid gap-4">
      <div className="flex items-baseline justify-between">
        <div className="label-caps text-ink/55">Tasks · {tasks.length} 件未完成</div>
        <TaskComposer
          base={base}
          snapshot={snapshot}
          isFixtures={isFixtures}
          onCreated={onCreated}
          onIdResolved={onIdResolved}
          onCreateFailed={onDelete}
        />
      </div>
      {tasks.length === 0 ? (
        <div className="rounded-md border border-ink/10 bg-cream/40 px-6 py-12 text-center text-sm font-semibold text-ink/45">
          沒有未完成任務。{!isFixtures && ' 上方點「+ 新增任務」開始'}
        </div>
      ) : (
        <ul className="grid gap-2">
          {tasks.map((t) => (
            <li key={t.id}>
              <TaskRow
                task={t}
                snapshot={snapshot}
                base={base}
                isFixtures={isFixtures}
                onLocalPatch={onPatch}
                onLocalDelete={onDelete}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
