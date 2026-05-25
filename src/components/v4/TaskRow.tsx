'use client';

// ============================================================
// 任務 row 元件 — TodayView / ClientDetailView 共用
// ============================================================
// 樂觀修改模型:
//   - 每個動作(勾完成 / 改優先級 / 刪除)立刻更新本地 shadow state
//   - 同時 fire-and-forget 寫 DB
//   - 失敗自動回滾 shadow + 顯示紅字錯誤
//   - 父層若想監聽變動(列表頁需要把 done 任務移出列表),
//     可帶 onChanged(action, taskOrId) callback
// ============================================================
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trash2, Check } from 'lucide-react';
import type { Task, TaskStatus, TaskPriority, Snapshot } from '@/lib/v4/types';
import { cn, daysUntil } from '@/lib/v4/utils';
import { patchTask, deleteTask, createTask } from '@/lib/v4/mutations';

const PRIORITY_CYCLE: TaskPriority[] = ['low', 'normal', 'high'];

export function TaskRow({
  task, snapshot, base, isFixtures, onLocalPatch, onLocalDelete,
}: {
  task: Task;
  snapshot: Snapshot;
  base: '/workspace' | '/hub';
  isFixtures: boolean;
  // 父層想同步本地列表時帶這兩個 callback
  // (例如 TodayView 把 status='done' 的任務移出畫面)
  onLocalPatch?: (taskId: string, patch: Partial<Task>) => void;
  onLocalDelete?: (taskId: string) => void;
}) {
  // tmp 任務(id 開頭 'tmp-')尚未從 DB 拿到真 id,不能對它做 patch/delete
  // 否則 patchTask(tmpId) 在 DB 完全找不到 row。等 swap 完才解鎖。
  const pending = task.id.startsWith('tmp-');
  // shadow state — 點下去立刻顯示新值
  const [localStatus, setLocalStatus] = useState<TaskStatus>(task.status);
  const [localPriority, setLocalPriority] = useState<TaskPriority>(task.priority);
  const [removed, setRemoved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { setLocalStatus(task.status); }, [task.status]);
  useEffect(() => { setLocalPriority(task.priority); }, [task.priority]);

  if (removed) return null;

  const done = localStatus === 'done';
  const due = daysUntil(task.due_date);
  const dueLabel = due === null ? '無期限' : due < 0 ? `逾期 ${Math.abs(due)} 天` : due === 0 ? '今天' : `${due} 天後`;
  const dueTone = due !== null && due < 0 ? 'text-claret' : due !== null && due <= 2 ? 'text-brass' : 'text-ink/55';
  const linkedDeal = snapshot.deals.find((d) => d.id === task.deal_id);

  function toggleDone() {
    if (isFixtures) { setErr('fixtures 模式無法寫入'); return; }
    if (pending) { setErr('還在建立中,請等一下'); return; }
    const next: TaskStatus = done ? 'todo' : 'done';
    const prev = localStatus;
    setLocalStatus(next);
    onLocalPatch?.(task.id, { status: next });
    setErr(null);
    patchTask(task.id, { status: next })
      .catch((e) => {
        setLocalStatus(prev);
        onLocalPatch?.(task.id, { status: prev });
        setErr((e as Error).message);
      });
  }

  function cyclePriority() {
    if (isFixtures || pending) return;
    const idx = PRIORITY_CYCLE.indexOf(localPriority);
    const next = PRIORITY_CYCLE[(idx + 1) % PRIORITY_CYCLE.length] as TaskPriority;
    const prev = localPriority;
    setLocalPriority(next);
    onLocalPatch?.(task.id, { priority: next });
    setErr(null);
    patchTask(task.id, { priority: next })
      .catch((e) => {
        setLocalPriority(prev);
        onLocalPatch?.(task.id, { priority: prev });
        setErr((e as Error).message);
      });
  }

  function doDelete() {
    if (isFixtures || pending) return;
    setRemoved(true);                // 立刻從畫面消失
    onLocalDelete?.(task.id);
    setErr(null);
    deleteTask(task.id)
      .catch((e) => { setRemoved(false); setErr((e as Error).message); });
  }

  return (
    <div className={cn(
      'grid grid-cols-[24px_1fr_auto_auto_auto] items-center gap-3 rounded-md border border-ink/10 bg-paper px-4 py-3 transition',
      done && 'opacity-60',
      pending && 'opacity-70',
    )}>
      <button
        type="button"
        onClick={toggleDone}
        disabled={isFixtures || pending}
        title={pending ? '建立中,請等一下…' : done ? '取消完成' : '標記完成'}
        className={cn(
          'grid h-5 w-5 place-items-center rounded-sm border transition',
          done ? 'border-forest bg-forest text-paper' : 'border-ink/25 bg-paper hover:border-ink/45',
          (isFixtures || pending) && 'cursor-not-allowed',
        )}
      >
        {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </button>

      <div className="min-w-0">
        <div className={cn('font-v4-serif text-base font-medium text-ink', done && 'line-through')}>{task.title}</div>
        {linkedDeal && (
          <Link href={`${base}/clients/${linkedDeal.id}` as never} className="mt-0.5 inline-flex items-center gap-1 font-v4-mono text-[11px] text-ink/55 hover:text-ink">
            <span>↗</span>
            <span className="truncate">{linkedDeal.name.replace(/^【範例】/, '')}</span>
          </Link>
        )}
      </div>

      <span className={cn('font-v4-mono text-xs numeric', dueTone)}>{dueLabel}</span>

      <button
        type="button"
        onClick={cyclePriority}
        disabled={isFixtures}
        title="點切換優先級"
        className={cn(
          'rounded-sm border px-1.5 py-0.5 font-v4-mono text-[10px] font-bold transition',
          localPriority === 'high' ? 'border-claret/30 bg-claret/8 text-claret'
            : localPriority === 'low' ? 'border-ink/15 text-ink/45'
              : 'border-ink/15 text-ink/65',
          isFixtures && 'cursor-not-allowed',
          !isFixtures && 'hover:border-ink/40',
        )}
      >
        {localPriority}
      </button>

      <button
        type="button"
        onClick={doDelete}
        disabled={isFixtures}
        title="刪除任務"
        className="grid h-7 w-7 place-items-center rounded-sm text-ink/40 transition hover:bg-claret/10 hover:text-claret disabled:cursor-not-allowed"
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
      </button>

      {err && <div className="col-span-5 mt-1 text-[11px] text-claret">{err}</div>}
    </div>
  );
}

// ============================================================
// 新增任務 composer — TodayView 上方用
// ============================================================
export function TaskComposer({
  base, snapshot, isFixtures, defaultDealId, onCreated, onIdResolved, onCreateFailed,
}: {
  base: '/workspace' | '/hub';
  snapshot: Snapshot;
  isFixtures: boolean;
  defaultDealId?: string;
  // 父層可帶 callback 拿到新建的 task,立刻 prepend 到列表
  onCreated?: (task: Task) => void;
  // DB 寫入回來後把 tmp id 換成 DB 真 id(不換 後續 patch/delete 打不到 row)
  onIdResolved?: (tmpId: string, realId: string) => void;
  // DB 寫入失敗,父層要把 tmp 從列表移除(避免出現操作不到的殭屍 row)
  onCreateFailed?: (tmpId: string) => void;
}) {
  void base;
  const [title, setTitle] = useState('');
  const [dealId, setDealId] = useState(defaultDealId ?? '');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  function submit() {
    if (!title.trim()) return;
    if (isFixtures) { setErr('fixtures 模式無法寫入'); return; }

    const titleVal = title.trim();
    const dueVal = dueDate || null;
    const priVal = priority;
    const linkedDeal = dealId || null;

    // 樂觀:立刻給父層一筆 tmp 任務 + 收起 composer
    const tmpTask: Task = {
      id: `tmp-${Date.now()}`,
      deal_id: linkedDeal,
      title: titleVal,
      description: '',
      assignee_id: null,
      due_date: dueVal,
      status: 'todo',
      priority: priVal,
      created_at: new Date().toISOString(),
      completed_at: null,
    };
    onCreated?.(tmpTask);
    setTitle(''); setDueDate(''); setPriority('normal'); setExpanded(false);
    setErr(null);

    // DB 寫入背景跑;成功就把 tmp id 換成真 id(後續 toggle/delete 才打得到 row),
    // 失敗就告訴父層把 tmp row 從列表移除
    createTask({
      deal_id: linkedDeal,
      title: titleVal,
      due_date: dueVal,
      priority: priVal,
      status: 'todo',
    })
      .then((realId) => onIdResolved?.(tmpTask.id, realId))
      .catch((e) => {
        setErr((e as Error).message);
        onCreateFailed?.(tmpTask.id);
      });
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        disabled={isFixtures}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border border-dashed border-ink/25 bg-paper/60 px-3 py-2 text-sm text-ink/65 transition hover:border-ink/45 hover:text-ink',
          isFixtures && 'cursor-not-allowed opacity-50',
        )}
      >
        + 新增任務
      </button>
    );
  }

  return (
    <div className="grid gap-2 rounded-md border border-ink/15 bg-paper p-3">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
        placeholder="任務標題,例如「準備配偶同席的一頁 EB 摘要」"
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } if (e.key === 'Escape') setExpanded(false); }}
        className="w-full rounded-md border border-ink/12 bg-cream/40 px-3 py-2 text-sm text-ink focus:border-ink/30 focus:outline-none"
      />
      <div className="grid grid-cols-[1fr_140px_120px_auto] items-center gap-2">
        {!defaultDealId && (
          <select
            value={dealId}
            onChange={(e) => setDealId(e.target.value)}
            className="rounded-md border border-ink/12 bg-cream/40 px-2.5 py-1.5 text-xs text-ink focus:border-ink/30 focus:outline-none"
          >
            <option value="">(不關聯案件)</option>
            {snapshot.deals.filter((d) => d.stage !== 'L7').map((d) => (
              <option key={d.id} value={d.id}>{d.name.replace(/^【範例】/, '')}</option>
            ))}
          </select>
        )}
        {defaultDealId && <div />}
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="rounded-md border border-ink/12 bg-cream/40 px-2.5 py-1.5 font-v4-mono text-xs text-ink focus:border-ink/30 focus:outline-none"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority)}
          className="rounded-md border border-ink/12 bg-cream/40 px-2.5 py-1.5 font-v4-mono text-xs text-ink focus:border-ink/30 focus:outline-none"
        >
          <option value="low">low</option>
          <option value="normal">normal</option>
          <option value="high">high</option>
        </select>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setExpanded(false)} className="rounded-md px-2 py-1.5 text-xs text-ink/55 hover:text-ink">取消</button>
          <button
            type="button"
            onClick={submit}
            disabled={!title.trim()}
            className="inline-flex items-center gap-1 rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-paper hover:bg-graphite disabled:bg-ink/30"
          >
            <Check className="h-3 w-3" strokeWidth={2} />
            新增
          </button>
        </div>
      </div>
      {err && <div className="text-[11px] text-claret">{err}</div>}
      <div className="font-v4-mono text-[10.5px] text-ink/45">Enter 新增 · Esc 取消</div>
    </div>
  );
}
