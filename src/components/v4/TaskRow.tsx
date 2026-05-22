'use client';

// ============================================================
// 任務 row 元件 — TodayView / ClientDetailView 共用
// ============================================================
// 互動內容:
//   - checkbox 切換 status todo ↔ done(完成時打 strikethrough)
//   - 點 priority 切換(low / normal / high 循環)
//   - 垃圾桶刪除(無 confirm,刪錯靠 router.refresh 後重建即可)
//   - 連到關聯 deal 的 quick link
// ============================================================
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Trash2, Loader2, Check } from 'lucide-react';
import type { Task, TaskStatus, TaskPriority, Snapshot } from '@/lib/v4/types';
import { cn, daysUntil } from '@/lib/v4/utils';
import { patchTask, deleteTask } from '@/lib/v4/mutations';

const PRIORITY_CYCLE: TaskPriority[] = ['low', 'normal', 'high'];

export function TaskRow({
  task, snapshot, base, isFixtures,
}: {
  task: Task;
  snapshot: Snapshot;
  base: '/v4/workspace' | '/v4/hub';
  isFixtures: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<null | 'check' | 'priority' | 'delete'>(null);
  const [err, setErr] = useState<string | null>(null);

  const done = task.status === 'done';
  const due = daysUntil(task.due_date);
  const dueLabel = due === null ? '無期限' : due < 0 ? `逾期 ${Math.abs(due)} 天` : due === 0 ? '今天' : `${due} 天後`;
  const dueTone = due !== null && due < 0 ? 'text-claret' : due !== null && due <= 2 ? 'text-brass' : 'text-ink/55';
  const linkedDeal = snapshot.deals.find((d) => d.id === task.deal_id);

  async function toggleDone() {
    if (busy || isFixtures) { if (isFixtures) setErr('fixtures 模式無法寫入'); return; }
    setBusy('check'); setErr(null);
    try {
      await patchTask(task.id, { status: done ? 'todo' : 'done' });
      startTransition(() => router.refresh());
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  }

  async function cyclePriority() {
    if (busy || isFixtures) return;
    const idx = PRIORITY_CYCLE.indexOf(task.priority);
    const next = PRIORITY_CYCLE[(idx + 1) % PRIORITY_CYCLE.length] as TaskPriority;
    setBusy('priority'); setErr(null);
    try {
      await patchTask(task.id, { priority: next });
      startTransition(() => router.refresh());
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  }

  async function doDelete() {
    if (busy || isFixtures) return;
    setBusy('delete'); setErr(null);
    try {
      await deleteTask(task.id);
      startTransition(() => router.refresh());
    } catch (e) { setErr((e as Error).message); setBusy(null); }
  }

  return (
    <div className={cn(
      'grid grid-cols-[24px_1fr_auto_auto_auto] items-center gap-3 rounded-md border border-ink/10 bg-paper px-4 py-3 transition',
      done && 'opacity-60',
    )}>
      <button
        type="button"
        onClick={toggleDone}
        disabled={busy === 'check' || isFixtures}
        title={done ? '取消完成' : '標記完成'}
        className={cn(
          'grid h-5 w-5 place-items-center rounded-sm border transition',
          done ? 'border-forest bg-forest text-paper' : 'border-ink/25 bg-paper hover:border-ink/45',
          (busy === 'check' || isFixtures) && 'cursor-not-allowed',
        )}
      >
        {busy === 'check' ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.5} /> : done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
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
        disabled={busy === 'priority' || isFixtures}
        title="點切換優先級"
        className={cn(
          'rounded-sm border px-1.5 py-0.5 font-v4-mono text-[10px] font-bold transition',
          task.priority === 'high' ? 'border-claret/30 bg-claret/8 text-claret'
            : task.priority === 'low' ? 'border-ink/15 text-ink/45'
              : 'border-ink/15 text-ink/65',
          (busy === 'priority' || isFixtures) && 'cursor-not-allowed',
          !isFixtures && 'hover:border-ink/40',
        )}
      >
        {busy === 'priority' ? '…' : task.priority}
      </button>

      <button
        type="button"
        onClick={doDelete}
        disabled={busy !== null || isFixtures}
        title="刪除任務"
        className="grid h-7 w-7 place-items-center rounded-sm text-ink/40 transition hover:bg-claret/10 hover:text-claret disabled:cursor-not-allowed"
      >
        {busy === 'delete' ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />}
      </button>

      {err && <div className="col-span-5 mt-1 text-[11px] text-claret">{err}</div>}
    </div>
  );
}

// ============================================================
// 新增任務 composer — TodayView 上方用
// ============================================================
export function TaskComposer({
  base, snapshot, isFixtures, defaultDealId,
}: {
  base: '/v4/workspace' | '/v4/hub';
  snapshot: Snapshot;
  isFixtures: boolean;
  defaultDealId?: string;
}) {
  void base;
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [title, setTitle] = useState('');
  const [dealId, setDealId] = useState(defaultDealId ?? '');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function submit() {
    if (!title.trim() || busy) return;
    if (isFixtures) { setErr('fixtures 模式無法寫入'); return; }
    setBusy(true); setErr(null);
    try {
      const { createTask } = await import('@/lib/v4/mutations');
      await createTask({
        deal_id: dealId || null,
        title: title.trim(),
        due_date: dueDate || null,
        priority,
        status: 'todo' as TaskStatus,
      });
      setTitle(''); setDueDate(''); setPriority('normal'); setExpanded(false);
      startTransition(() => router.refresh());
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
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
        disabled={busy}
        className="w-full rounded-md border border-ink/12 bg-cream/40 px-3 py-2 text-sm text-ink focus:border-ink/30 focus:outline-none"
      />
      <div className="grid grid-cols-[1fr_140px_120px_auto] items-center gap-2">
        {!defaultDealId && (
          <select
            value={dealId}
            onChange={(e) => setDealId(e.target.value)}
            disabled={busy}
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
          disabled={busy}
          className="rounded-md border border-ink/12 bg-cream/40 px-2.5 py-1.5 font-v4-mono text-xs text-ink focus:border-ink/30 focus:outline-none"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority)}
          disabled={busy}
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
            disabled={busy || !title.trim()}
            className="inline-flex items-center gap-1 rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-paper hover:bg-graphite disabled:bg-ink/30"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} /> : <Check className="h-3 w-3" strokeWidth={2} />}
            新增
          </button>
        </div>
      </div>
      {err && <div className="text-[11px] text-claret">{err}</div>}
      <div className="font-v4-mono text-[10.5px] text-ink/45">Enter 新增 · Esc 取消</div>
    </div>
  );
}
