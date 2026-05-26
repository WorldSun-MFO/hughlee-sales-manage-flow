'use client';

// ============================================================
// 任務 row 元件 — TodayView / ClientDetailView 共用
// ============================================================
// 樂觀修改模型:
//   - 每個動作(勾完成 / 改狀態 / 改優先級 / 改指派 / 改日期 / 刪除)
//     立刻更新本地 shadow state
//   - 同時 fire-and-forget 寫 DB
//   - 失敗自動回滾 shadow + 顯示紅字錯誤
//   - 父層若想同步本地列表(列表頁要重新排序 / 移除),
//     可帶 onLocalPatch / onLocalDelete callback
//   - 完成的任務「不」消失:父層只重新排序(沉到最後),由 done 樣式
//     畫上刪除線。真正移除只在使用者按刪除時發生。
// ============================================================
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trash2, Check } from 'lucide-react';
import type { Task, TaskStatus, TaskPriority, Snapshot } from '@/lib/v4/types';
import { cn, daysUntil } from '@/lib/v4/utils';
import { patchTask, deleteTask, createTask } from '@/lib/v4/mutations';

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: '待辦' },
  { value: 'doing', label: '進行中' },
  { value: 'done', label: '完成' },
];
const STATUS_PILL: Record<TaskStatus, string> = {
  todo: 'border-ink/15 text-ink/60 bg-paper',
  doing: 'border-cobalt/30 text-cobalt bg-cobalt/8',
  done: 'border-forest/30 text-forest bg-forest/8',
};
const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'high', label: '高' },
  { value: 'normal', label: '中' },
  { value: 'low', label: '低' },
];
const PRIORITY_PILL: Record<TaskPriority, string> = {
  high: 'border-claret/30 text-claret bg-claret/8',
  normal: 'border-ink/15 text-ink/65 bg-paper',
  low: 'border-ink/15 text-ink/45 bg-paper',
};

export function TaskRow({
  task, snapshot, base, isFixtures, onLocalPatch, onLocalDelete,
}: {
  task: Task;
  snapshot: Snapshot;
  base: '/workspace' | '/hub';
  isFixtures: boolean;
  // 父層想同步本地列表時帶這兩個 callback
  // (例如 TodayView 把完成的任務重新排序到最後)
  onLocalPatch?: (taskId: string, patch: Partial<Task>) => void;
  onLocalDelete?: (taskId: string) => void;
}) {
  // tmp 任務(id 開頭 'tmp-')尚未從 DB 拿到真 id,不能對它做 patch/delete
  // 否則 patchTask(tmpId) 在 DB 完全找不到 row。等 swap 完才解鎖。
  const pending = task.id.startsWith('tmp-');
  // shadow state — 點下去立刻顯示新值
  const [localStatus, setLocalStatus] = useState<TaskStatus>(task.status);
  const [localPriority, setLocalPriority] = useState<TaskPriority>(task.priority);
  const [localAssignee, setLocalAssignee] = useState<string | null>(task.assignee_id);
  const [localDue, setLocalDue] = useState<string | null>(task.due_date);
  const [removed, setRemoved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { setLocalStatus(task.status); }, [task.status]);
  useEffect(() => { setLocalPriority(task.priority); }, [task.priority]);
  useEffect(() => { setLocalAssignee(task.assignee_id); }, [task.assignee_id]);
  useEffect(() => { setLocalDue(task.due_date); }, [task.due_date]);

  if (removed) return null;

  const done = localStatus === 'done';
  const due = daysUntil(localDue);
  const dueLabel = due === null ? '無期限' : due < 0 ? `逾期 ${Math.abs(due)} 天` : due === 0 ? '今天' : `${due} 天後`;
  const dueTone = due !== null && due < 0 ? 'text-claret' : due !== null && due <= 2 ? 'text-brass' : 'text-ink/55';
  const linkedDeal = snapshot.deals.find((d) => d.id === task.deal_id);
  const locked = isFixtures || pending;

  function guard(): boolean {
    if (isFixtures) { setErr('fixtures 模式無法寫入'); return false; }
    if (pending) { setErr('還在建立中,請等一下'); return false; }
    return true;
  }

  function changeStatus(next: TaskStatus) {
    if (!guard()) return;
    const prev = localStatus;
    setLocalStatus(next);
    onLocalPatch?.(task.id, { status: next });
    setErr(null);
    patchTask(task.id, { status: next }).catch((e) => {
      setLocalStatus(prev);
      onLocalPatch?.(task.id, { status: prev });
      setErr((e as Error).message);
    });
  }

  function changePriority(next: TaskPriority) {
    if (!guard()) return;
    const prev = localPriority;
    setLocalPriority(next);
    onLocalPatch?.(task.id, { priority: next });
    setErr(null);
    patchTask(task.id, { priority: next }).catch((e) => {
      setLocalPriority(prev);
      onLocalPatch?.(task.id, { priority: prev });
      setErr((e as Error).message);
    });
  }

  function changeAssignee(next: string | null) {
    if (!guard()) return;
    const prev = localAssignee;
    setLocalAssignee(next);
    onLocalPatch?.(task.id, { assignee_id: next });
    setErr(null);
    patchTask(task.id, { assignee_id: next }).catch((e) => {
      setLocalAssignee(prev);
      onLocalPatch?.(task.id, { assignee_id: prev });
      setErr((e as Error).message);
    });
  }

  function changeDue(next: string | null) {
    if (!guard()) return;
    const prev = localDue;
    setLocalDue(next);
    onLocalPatch?.(task.id, { due_date: next });
    setErr(null);
    patchTask(task.id, { due_date: next }).catch((e) => {
      setLocalDue(prev);
      onLocalPatch?.(task.id, { due_date: prev });
      setErr((e as Error).message);
    });
  }

  function toggleDone() {
    changeStatus(done ? 'todo' : 'done');
  }

  function doDelete() {
    if (locked) return;
    setRemoved(true);                // 立刻從畫面消失(這才是真的移除)
    onLocalDelete?.(task.id);
    setErr(null);
    deleteTask(task.id)
      .catch((e) => { setRemoved(false); setErr((e as Error).message); });
  }

  const controlBase = 'rounded-sm border px-1.5 py-0.5 font-v4-mono text-[10px] outline-none transition';

  return (
    <div className={cn(
      'grid grid-cols-[24px_1fr_auto] items-start gap-3 rounded-md border border-ink/10 bg-paper px-4 py-3 transition',
      done && 'opacity-60',
      pending && 'opacity-70',
    )}>
      <button
        type="button"
        onClick={toggleDone}
        disabled={locked}
        title={pending ? '建立中,請等一下…' : done ? '取消完成' : '標記完成'}
        className={cn(
          'mt-0.5 grid h-5 w-5 place-items-center rounded-sm border transition',
          done ? 'border-forest bg-forest text-paper' : 'border-ink/25 bg-paper hover:border-ink/45',
          locked && 'cursor-not-allowed',
        )}
      >
        {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </button>

      <div className="grid min-w-0 gap-1.5">
        <div className={cn('font-v4-serif text-base font-medium text-ink', done && 'text-ink/45 line-through')}>
          {task.title}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {linkedDeal && (
            <Link href={`${base}/clients/${linkedDeal.id}` as never} className="inline-flex items-center gap-1 font-v4-mono text-[11px] text-ink/55 hover:text-ink">
              <span>↗</span>
              <span className="max-w-[160px] truncate">{linkedDeal.name.replace(/^【範例】/, '')}</span>
            </Link>
          )}

          {/* 指派給誰 */}
          <select
            value={localAssignee ?? ''}
            onChange={(e) => changeAssignee(e.target.value || null)}
            disabled={locked}
            title="指派給"
            className={cn(
              controlBase, 'border-ink/15 bg-paper text-ink/65',
              locked ? 'cursor-not-allowed' : 'cursor-pointer hover:border-ink/40',
            )}
          >
            <option value="">未指派</option>
            {snapshot.profiles.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
            ))}
          </select>

          {/* 到期日 */}
          <input
            type="date"
            value={localDue ?? ''}
            onChange={(e) => changeDue(e.target.value || null)}
            disabled={locked}
            title="到期日"
            className={cn(
              controlBase, 'border-ink/15 bg-paper text-ink/65',
              locked ? 'cursor-not-allowed' : 'cursor-pointer hover:border-ink/40',
            )}
          />
          {localDue && !done && (
            <span className={cn('font-v4-mono text-[10px] numeric', dueTone)}>{dueLabel}</span>
          )}

          {/* 狀態:待辦 / 進行中 / 完成 */}
          <select
            value={localStatus}
            onChange={(e) => changeStatus(e.target.value as TaskStatus)}
            disabled={locked}
            title="狀態"
            className={cn(
              controlBase, 'font-bold', STATUS_PILL[localStatus],
              locked ? 'cursor-not-allowed' : 'cursor-pointer',
            )}
          >
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {/* 優先級:高 / 中 / 低 */}
          <select
            value={localPriority}
            onChange={(e) => changePriority(e.target.value as TaskPriority)}
            disabled={locked}
            title="優先級"
            className={cn(
              controlBase, 'font-bold', PRIORITY_PILL[localPriority],
              locked ? 'cursor-not-allowed' : 'cursor-pointer',
            )}
          >
            {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        {err && <div className="text-[11px] text-claret">{err}</div>}
      </div>

      <button
        type="button"
        onClick={doDelete}
        disabled={locked}
        title="刪除任務"
        className="mt-0.5 grid h-7 w-7 place-items-center rounded-sm text-ink/40 transition hover:bg-claret/10 hover:text-claret disabled:cursor-not-allowed"
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
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
  const [assigneeId, setAssigneeId] = useState('');
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
    const assignee = assigneeId || null;

    // 樂觀:立刻給父層一筆 tmp 任務 + 收起 composer
    const tmpTask: Task = {
      id: `tmp-${Date.now()}`,
      deal_id: linkedDeal,
      title: titleVal,
      description: '',
      assignee_id: assignee,
      due_date: dueVal,
      status: 'todo',
      priority: priVal,
      created_at: new Date().toISOString(),
      completed_at: null,
    };
    onCreated?.(tmpTask);
    setTitle(''); setAssigneeId(''); setDueDate(''); setPriority('normal'); setExpanded(false);
    setErr(null);

    // DB 寫入背景跑;成功就把 tmp id 換成真 id(後續 toggle/delete 才打得到 row),
    // 失敗就告訴父層把 tmp row 從列表移除
    createTask({
      deal_id: linkedDeal,
      title: titleVal,
      assignee_id: assignee,
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

  const fieldCls = 'rounded-md border border-ink/12 bg-cream/40 px-2.5 py-1.5 text-xs text-ink focus:border-ink/30 focus:outline-none';

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
      <div className="flex flex-wrap items-center gap-2">
        {!defaultDealId && (
          <select
            value={dealId}
            onChange={(e) => setDealId(e.target.value)}
            className={cn(fieldCls, 'min-w-[150px] flex-1')}
          >
            <option value="">(不關聯案件)</option>
            {snapshot.deals.filter((d) => d.stage !== 'L7').map((d) => (
              <option key={d.id} value={d.id}>{d.name.replace(/^【範例】/, '')}</option>
            ))}
          </select>
        )}
        <select
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          title="指派給"
          className={cn(fieldCls, 'min-w-[120px]')}
        >
          <option value="">未指派</option>
          {snapshot.profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
          ))}
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className={cn(fieldCls, 'font-v4-mono')}
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority)}
          title="優先級"
          className={cn(fieldCls, 'font-v4-mono')}
        >
          <option value="high">高</option>
          <option value="normal">中</option>
          <option value="low">低</option>
        </select>
        <div className="ml-auto flex items-center gap-1.5">
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
