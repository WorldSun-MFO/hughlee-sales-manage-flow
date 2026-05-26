'use client';

// ============================================================
// 我的任務 — 獨立 view
// ============================================================
// 原本是「今日」的一個分頁,現已移到側邊欄成為獨立項目(/workspace/tasks、/hub/tasks)。
//
// 篩選 / 分組(資料已由 RLS 過濾,snapshot 只含權限內的 deals/tasks):
//   - 狀態:全部 / 待辦 / 進行中 / 已完成
//   - 指派:全部 / 我的任務 / 權限內出現過的成員(從可見任務推導)
//   - 案件:全部 / 權限內的客戶
//   - 只看逾期、搜尋(任務標題 + 客戶名)
//   - 分組切換:指派人 / 狀態 / 不分組
// 完成的任務沉到每組最後;樂觀新增 / 勾選 / 改 / 刪(寫入由 TaskRow / TaskComposer 背景跑)。
// ============================================================
import { useEffect, useState } from 'react';
import type { Profile, Snapshot, Task, TaskStatus } from '@/lib/v4/types';
import { daysUntil } from '@/lib/v4/utils';
import { TaskRow, TaskComposer } from '@/components/v4/TaskRow';
import { RealtimeRefresher } from '@/components/v4/RealtimeRefresher';

const UNASSIGNED = '∅';
const STATUS_LABEL: Record<TaskStatus, string> = { todo: '待辦', doing: '進行中', done: '完成' };
const STATUS_ORDER: Record<TaskStatus, number> = { todo: 0, doing: 1, done: 2 };
const ctrl = 'rounded-md border border-ink/12 bg-paper px-2.5 py-1.5 text-xs text-ink focus:border-ink/30 focus:outline-none';

// 組內排序:未完成在前、完成的沉到最後;同段內再依到期日(近的在前,無期限最後)
function sortWithinGroup(a: Task, b: Task): number {
  const ad = a.status === 'done' ? 1 : 0;
  const bd = b.status === 'done' ? 1 : 0;
  if (ad !== bd) return ad - bd;
  const av = a.due_date ?? '9999-12-31';
  const bv = b.due_date ?? '9999-12-31';
  if (av !== bv) return av < bv ? -1 : 1;
  return 0;
}

type GroupBy = 'assignee' | 'status' | 'none';

export function TasksView({
  snapshot, base, profile,
}: {
  snapshot: Snapshot;
  base: '/workspace' | '/hub';
  profile: Profile | null;
}) {
  const isFixtures = snapshot.source === 'fixtures';

  // 樂觀本地 task list:server snapshot 為初始值,新增 / 勾完成 / 改 / 刪都先改這裡
  const [tasksLocal, setTasksLocal] = useState<Task[]>(snapshot.tasks);
  useEffect(() => { setTasksLocal(snapshot.tasks); }, [snapshot.tasks]);

  const [filter, setFilter] = useState({
    status: '' as '' | TaskStatus,
    assignee: '' as string,   // '' = 全部;profile.id = 我的任務;其他 = 該成員
    dealId: '' as string,
    overdueOnly: false,
    search: '',
  });
  const [groupBy, setGroupBy] = useState<GroupBy>('assignee');

  function handleCreated(task: Task) { setTasksLocal((prev) => [task, ...prev]); }
  function handlePatch(taskId: string, patch: Partial<Task>) {
    setTasksLocal((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)));
  }
  function handleDelete(taskId: string) { setTasksLocal((prev) => prev.filter((t) => t.id !== taskId)); }
  // DB 寫入回來:把 tmp id 換成真 id(讓後續 toggle/delete 用真 id)
  function handleIdResolved(tmpId: string, realId: string) {
    setTasksLocal((prev) => prev.map((t) => (t.id === tmpId ? { ...t, id: realId } : t)));
  }

  const nameOf = (id: string) => {
    if (id === UNASSIGNED) return '未指派';
    const p = snapshot.profiles.find((x) => x.id === id);
    return p?.full_name || p?.email || '未知成員';
  };

  // 指派下拉選項:從「可見任務」實際出現的指派人推導(= 權限內的成員),不列全公司
  const assigneeIds = Array.from(
    new Set(tasksLocal.map((t) => t.assignee_id).filter((x): x is string => !!x && x !== profile?.id)),
  );
  // 案件下拉:權限內的客戶(snapshot 已 RLS 過濾)
  const dealOptions = [...snapshot.deals].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));

  // 套用篩選
  const filtered = tasksLocal.filter((t) => {
    if (filter.status && t.status !== filter.status) return false;
    if (filter.assignee && t.assignee_id !== filter.assignee) return false;
    if (filter.dealId && t.deal_id !== filter.dealId) return false;
    if (filter.overdueOnly) {
      if (t.status === 'done') return false;
      const d = daysUntil(t.due_date);
      if (d === null || d >= 0) return false;   // 逾期 = 已過期(d < 0)
    }
    if (filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      const dealName = snapshot.deals.find((d) => d.id === t.deal_id)?.name ?? '';
      if (!`${t.title} ${dealName}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const filteredOpen = filtered.filter((t) => t.status !== 'done').length;

  // 依 groupBy 分組
  type Group = { key: string; name: string; items: Task[]; open: number; done: number };
  let groups: Group[];
  if (groupBy === 'none') {
    groups = [{
      key: 'all',
      name: '全部任務',
      items: [...filtered].sort(sortWithinGroup),
      open: filtered.filter((t) => t.status !== 'done').length,
      done: filtered.filter((t) => t.status === 'done').length,
    }];
  } else {
    const map = new Map<string, Task[]>();
    for (const t of filtered) {
      const key = groupBy === 'assignee' ? (t.assignee_id ?? UNASSIGNED) : t.status;
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    groups = [...map.entries()].map(([key, items]) => ({
      key,
      name: groupBy === 'assignee' ? nameOf(key) : STATUS_LABEL[key as TaskStatus],
      items: [...items].sort(sortWithinGroup),
      open: items.filter((t) => t.status !== 'done').length,
      done: items.filter((t) => t.status === 'done').length,
    }));
    if (groupBy === 'assignee') {
      // 有未完成的群組在前;「未指派」永遠墊底;其餘依名字
      groups.sort((a, b) => {
        if ((a.key === UNASSIGNED) !== (b.key === UNASSIGNED)) return a.key === UNASSIGNED ? 1 : -1;
        if (a.open !== b.open) return b.open - a.open;
        return a.name.localeCompare(b.name, 'zh-Hant');
      });
    } else {
      // 狀態分組固定順序:待辦 → 進行中 → 完成
      groups.sort((a, b) => STATUS_ORDER[a.key as TaskStatus] - STATUS_ORDER[b.key as TaskStatus]);
    }
  }

  const showGroupHeader = groupBy !== 'none';

  return (
    <div className="grid gap-8 px-4 py-6 sm:px-8 sm:py-10 lg:px-14 lg:py-14">
      <RealtimeRefresher isFixtures={isFixtures} tables={['tasks', 'deals']} />

      <header className="grid gap-2">
        <div className="label-caps text-ink/45">Tasks</div>
        <h1 className="font-v4-serif text-[44px] font-medium leading-[1.05] tracking-tight text-ink lg:text-[56px]">
          我的任務
        </h1>
        <p className="max-w-2xl text-base leading-7 text-ink/65">
          {tasksLocal.length === 0
            ? '目前沒有任務。'
            : `符合條件 ${filtered.length} 件 · ${filteredOpen} 個未完成`}
        </p>
      </header>

      {/* 篩選列 */}
      <section className="flex flex-wrap items-center gap-2 rounded-md border border-ink/10 bg-cream/40 p-3">
        <select
          value={filter.status}
          onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value as '' | TaskStatus }))}
          className={ctrl}
        >
          <option value="">全部狀態</option>
          <option value="todo">待辦</option>
          <option value="doing">進行中</option>
          <option value="done">已完成</option>
        </select>

        <select
          value={filter.assignee}
          onChange={(e) => setFilter((f) => ({ ...f, assignee: e.target.value }))}
          className={ctrl}
        >
          <option value="">全部指派</option>
          {profile && <option value={profile.id}>我的任務</option>}
          {assigneeIds.map((id) => (
            <option key={id} value={id}>{nameOf(id)}</option>
          ))}
        </select>

        <select
          value={filter.dealId}
          onChange={(e) => setFilter((f) => ({ ...f, dealId: e.target.value }))}
          className={ctrl}
        >
          <option value="">全部案件</option>
          {dealOptions.map((d) => (
            <option key={d.id} value={d.id}>{d.name.replace(/^【範例】/, '')}</option>
          ))}
        </select>

        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-ink/12 bg-paper px-2.5 py-1.5 text-xs text-ink/70 transition hover:border-ink/30">
          <input
            type="checkbox"
            checked={filter.overdueOnly}
            onChange={(e) => setFilter((f) => ({ ...f, overdueOnly: e.target.checked }))}
            className="accent-claret"
          />
          只看逾期
        </label>

        <input
          type="search"
          value={filter.search}
          onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
          placeholder="搜尋任務 / 客戶…"
          className={`${ctrl} min-w-[140px] flex-1`}
        />

        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as GroupBy)}
          className={ctrl}
          title="分組方式"
        >
          <option value="assignee">分組:指派人</option>
          <option value="status">分組:狀態</option>
          <option value="none">不分組</option>
        </select>
      </section>

      <section className="grid gap-4">
        <div className="flex items-baseline justify-between">
          <div className="label-caps text-ink/55">{filtered.length} 件 · {filteredOpen} 未完成</div>
          <TaskComposer
            base={base}
            snapshot={snapshot}
            isFixtures={isFixtures}
            onCreated={handleCreated}
            onIdResolved={handleIdResolved}
            onCreateFailed={handleDelete}
          />
        </div>

        {tasksLocal.length === 0 ? (
          <div className="rounded-md border border-ink/10 bg-cream/40 px-6 py-12 text-center text-sm font-semibold text-ink/45">
            還沒有任務。{!isFixtures && ' 上方點「+ 新增任務」開始'}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-md border border-dashed border-ink/15 bg-paper/60 px-6 py-10 text-center text-sm text-ink/45">
            沒有符合條件的任務。
          </div>
        ) : (
          <div className="grid gap-5">
            {groups.map((g) => (
              <div key={g.key} className="grid gap-2">
                {showGroupHeader && (
                  <div className="flex items-baseline justify-between border-b border-ink/10 pb-1">
                    <div className="font-v4-serif text-sm font-semibold text-ink">{g.name}</div>
                    <div className="font-v4-mono text-[10.5px] text-ink/45">{g.open} 未完成 · {g.done} 完成</div>
                  </div>
                )}
                <ul className="grid gap-2">
                  {g.items.map((t) => (
                    <li key={t.id}>
                      <TaskRow
                        task={t}
                        snapshot={snapshot}
                        base={base}
                        isFixtures={isFixtures}
                        onLocalPatch={handlePatch}
                        onLocalDelete={handleDelete}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
