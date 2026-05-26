'use client';

// ============================================================
// 我的任務 — 獨立 view
// ============================================================
// 原本是「今日」的一個分頁,現已移到側邊欄成為獨立項目(/workspace/tasks、/hub/tasks)。
// 依指派人分組;完成的沉到每組最後;樂觀新增 / 勾選 / 改 / 刪(寫入由 TaskRow / TaskComposer 背景跑)。
// ============================================================
import { useEffect, useState } from 'react';
import type { Snapshot, Task } from '@/lib/v4/types';
import { TaskRow, TaskComposer } from '@/components/v4/TaskRow';
import { RealtimeRefresher } from '@/components/v4/RealtimeRefresher';

const UNASSIGNED = '∅';

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

export function TasksView({ snapshot, base }: { snapshot: Snapshot; base: '/workspace' | '/hub' }) {
  const isFixtures = snapshot.source === 'fixtures';

  // 樂觀本地 task list:server snapshot 為初始值,新增 / 勾完成 / 改 / 刪都先改這裡
  const [tasksLocal, setTasksLocal] = useState<Task[]>(snapshot.tasks);
  useEffect(() => { setTasksLocal(snapshot.tasks); }, [snapshot.tasks]);

  const openCount = tasksLocal.filter((t) => t.status !== 'done').length;

  function handleCreated(task: Task) { setTasksLocal((prev) => [task, ...prev]); }
  function handlePatch(taskId: string, patch: Partial<Task>) {
    setTasksLocal((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)));
  }
  function handleDelete(taskId: string) { setTasksLocal((prev) => prev.filter((t) => t.id !== taskId)); }
  // DB 寫入回來:把 tmp id 換成真 id(讓後續 toggle/delete 用真 id)
  function handleIdResolved(tmpId: string, realId: string) {
    setTasksLocal((prev) => prev.map((t) => (t.id === tmpId ? { ...t, id: realId } : t)));
  }

  // 依指派人分組,讓「誰要做什麼」一目瞭然
  const byAssignee = new Map<string, Task[]>();
  for (const t of tasksLocal) {
    const key = t.assignee_id ?? UNASSIGNED;
    const arr = byAssignee.get(key) ?? [];
    arr.push(t);
    byAssignee.set(key, arr);
  }
  const nameOf = (id: string) => {
    if (id === UNASSIGNED) return '未指派';
    const p = snapshot.profiles.find((x) => x.id === id);
    return p?.full_name || p?.email || '未知成員';
  };
  const groups = [...byAssignee.entries()]
    .map(([key, items]) => ({
      key,
      name: nameOf(key),
      items: [...items].sort(sortWithinGroup),
      open: items.filter((t) => t.status !== 'done').length,
      done: items.filter((t) => t.status === 'done').length,
    }))
    // 有未完成的群組在前;「未指派」永遠排最後;其餘依名字
    .sort((a, b) => {
      if ((a.key === UNASSIGNED) !== (b.key === UNASSIGNED)) return a.key === UNASSIGNED ? 1 : -1;
      if (a.open !== b.open) return b.open - a.open;
      return a.name.localeCompare(b.name, 'zh-Hant');
    });

  return (
    <div className="grid gap-8 px-4 py-6 sm:px-8 sm:py-10 lg:px-14 lg:py-14">
      <RealtimeRefresher isFixtures={isFixtures} tables={['tasks', 'deals']} />

      <header className="grid gap-2">
        <div className="label-caps text-ink/45">Tasks</div>
        <h1 className="font-v4-serif text-[44px] font-medium leading-[1.05] tracking-tight text-ink lg:text-[56px]">
          我的任務
        </h1>
        <p className="max-w-2xl text-base leading-7 text-ink/65">
          {openCount > 0 ? `${openCount} 個未完成任務 · 共 ${tasksLocal.length} 件` : '目前沒有未完成任務。'}
        </p>
      </header>

      <section className="grid gap-4">
        <div className="flex items-baseline justify-between">
          <div className="label-caps text-ink/55">依指派人分組 · {openCount} 未完成 · {tasksLocal.length} 全部</div>
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
        ) : (
          <div className="grid gap-5">
            {groups.map((g) => (
              <div key={g.key} className="grid gap-2">
                <div className="flex items-baseline justify-between border-b border-ink/10 pb-1">
                  <div className="font-v4-serif text-sm font-semibold text-ink">{g.name}</div>
                  <div className="font-v4-mono text-[10.5px] text-ink/45">{g.open} 未完成 · {g.done} 完成</div>
                </div>
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
