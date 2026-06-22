'use client';

import type { Snapshot, Task } from '@/lib/v4/types';
import { TaskRow, TaskComposer } from '@/components/v4/TaskRow';

export function TasksClient({
  base, dealId, tasks, snapshotLite, isFixtures,
}: {
  base: '/workspace' | '/hub';
  dealId: string;
  tasks: Task[];
  snapshotLite: Snapshot;
  isFixtures: boolean;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex items-baseline justify-between">
        <div className="label-caps text-ink/55">任務 · {tasks.length}</div>
        <TaskComposer base={base} snapshot={snapshotLite} isFixtures={isFixtures} defaultDealId={dealId} />
      </div>
      {tasks.length > 0 ? (
        <ul className="grid gap-2">
          {tasks.map((t) => (
            // id + scroll-mt:上方「未來規劃 / 後續需要做」方塊用 #task-<id> 連到這裡;
            // [&:target] 在被連到時高亮 1 圈,讓使用者一眼看到是哪一筆。
            <li
              key={t.id}
              id={`task-${t.id}`}
              className="scroll-mt-24 rounded-md transition [&:target]:ring-2 [&:target]:ring-cobalt/50 [&:target]:ring-offset-2 [&:target]:ring-offset-cream"
            >
              <TaskRow task={t} snapshot={snapshotLite} base={base} isFixtures={isFixtures} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-md border border-dashed border-ink/15 bg-paper/60 px-4 py-6 text-center text-xs text-ink/45">
          此客戶沒有任務。上方「+ 新增任務」開始,或在「下一步」section 按「拆成任務」自動拆解。
        </div>
      )}
    </section>
  );
}
