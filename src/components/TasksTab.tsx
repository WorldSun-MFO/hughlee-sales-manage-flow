'use client';

/**
 * TasksTab — 正式 v1 任務頁。
 *
 * 2026-05-18 v2:版面整個套用 /v2b（設計方向 B）Task Manager 視覺語言 —
 *   統計卡帶（可點擊套既有篩選）、quick-filter pills、固定欄位列、
 *   群組頭像標題、左色條、到期分級 badge、灰系命令風。
 *
 * 嚴格保留:Props 介面、@/lib/types、所有 callbacks（onAddTask/onUpdateTask/
 * onDeleteTask/onOpenDeal）、filteredTasks/grouped 計算、列內即時編輯
 * (title/assignee/due/priority/status/勾完成/刪除)、真實資料流。
 * 僅改 presentation;未動任何資料/權限/Supabase/篩選邏輯。
 * quick pills 只是把「既有 filter state」換個操作介面,未新增任何篩選述語。
 */

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Link2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Deal, Profile, Task, TaskPriority, TaskStatus } from '@/lib/types';

interface Props {
  tasks: Task[];
  deals: Deal[];
  profiles: Profile[];
  profile: Profile;             // 目前登入者
  onOpenDeal: (dealId: string) => void;
  onAddTask: (input: {
    title: string; deal_id: string | null; assignee_id: string | null;
    due_date: string | null; priority: TaskPriority;
  }) => Promise<void>;
  onUpdateTask: (id: string, patch: Partial<Task>) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
}

const STATUS_LABEL: Record<TaskStatus, string> = { todo: '待辦', doing: '進行中', done: '完成' };
const STATUS_PILL: Record<TaskStatus, string> = {
  todo: 'bg-zinc-100 text-zinc-600',
  doing: 'bg-sky-50 text-sky-700',
  done: 'bg-emerald-50 text-emerald-700',
};
const PRIORITY_PILL: Record<TaskPriority, string> = {
  high: 'bg-rose-50 text-rose-700',
  normal: 'bg-zinc-100 text-zinc-600',
  low: 'bg-zinc-50 text-zinc-400',
};

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = (new Date(dateStr).getTime() - Date.now()) / 86400000;
  return Math.ceil(diff);
}

const GRID = 'lg:grid lg:grid-cols-[26px_minmax(0,1.7fr)_132px_84px_92px_28px] lg:items-center lg:gap-x-3';

export function TasksTab({ tasks, deals, profiles, profile, onOpenDeal, onAddTask, onUpdateTask, onDeleteTask }: Props) {
  const [filter, setFilter] = useState({
    status: '' as TaskStatus | 'open' | '',
    assignee: '' as string,
    dealId: '' as string,
    overdueOnly: false,
    search: '',
  });
  const [groupBy, setGroupBy] = useState<'assignee' | 'status' | 'none'>('assignee');
  const [showNew, setShowNew] = useState(false);

  // 新任務表單
  const [newTitle, setNewTitle] = useState('');
  const [newDealId, setNewDealId] = useState<string>('');
  const [newAssigneeId, setNewAssigneeId] = useState<string>(profile.id);
  const [newDueDate, setNewDueDate] = useState<string>('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('normal');
  const [adding, setAdding] = useState(false);

  async function submitNew() {
    if (!newTitle.trim()) { alert('請填任務標題'); return; }
    setAdding(true);
    try {
      await onAddTask({
        title: newTitle.trim(),
        deal_id: newDealId || null,
        assignee_id: newAssigneeId || null,
        due_date: newDueDate || null,
        priority: newPriority,
      });
      setNewTitle(''); setNewDealId(''); setNewDueDate(''); setNewPriority('normal');
      setShowNew(false);
    } catch (err) {
      alert('新增失敗:' + (err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (filter.status === 'open' && t.status === 'done') return false;
      if (filter.status && filter.status !== 'open' && t.status !== filter.status) return false;
      if (filter.assignee && t.assignee_id !== filter.assignee) return false;
      if (filter.dealId && t.deal_id !== filter.dealId) return false;
      if (filter.overdueOnly) {
        if (t.status === 'done') return false;
        const d = daysUntil(t.due_date);
        if (d === null || d > 0) return false;
      }
      if (filter.search) {
        const q = filter.search.toLowerCase();
        const dealName = deals.find(d => d.id === t.deal_id)?.name ?? '';
        const hay = `${t.title} ${t.description} ${dealName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tasks, filter, deals]);

  const grouped = useMemo(() => {
    if (groupBy === 'none') return { '全部任務': filteredTasks };
    const out: Record<string, Task[]> = {};
    for (const t of filteredTasks) {
      let key: string;
      if (groupBy === 'assignee') {
        const p = profiles.find(p => p.id === t.assignee_id);
        key = p?.full_name ?? (t.assignee_id ? '未知' : '未指派');
      } else {
        key = STATUS_LABEL[t.status];
      }
      if (!out[key]) out[key] = [];
      out[key].push(t);
    }
    return out;
  }, [filteredTasks, groupBy, profiles]);

  const openCount = tasks.filter(t => t.status !== 'done').length;
  const overdueCount = tasks.filter(t => {
    if (t.status === 'done') return false;
    const d = daysUntil(t.due_date);
    return d !== null && d < 0;
  }).length;
  const weekCount = tasks.filter(t => {
    if (t.status === 'done') return false;
    const d = daysUntil(t.due_date);
    return d !== null && d >= 0 && d <= 7;
  }).length;
  const mineCount = tasks.filter(t => t.assignee_id === profile.id && t.status !== 'done').length;

  const stats = [
    { label: '未完成', value: openCount, icon: ClipboardList, tone: 'text-zinc-600',
      on: () => setFilter(f => ({ ...f, status: 'open', overdueOnly: false })) },
    { label: '已逾期', value: overdueCount, icon: AlertTriangle,
      tone: overdueCount > 0 ? 'text-rose-600' : 'text-emerald-600',
      on: () => setFilter(f => ({ ...f, overdueOnly: true, status: 'open' })) },
    { label: '本週到期', value: weekCount, icon: CalendarClock,
      tone: weekCount > 0 ? 'text-amber-600' : 'text-emerald-600', on: undefined },
    { label: '我被指派', value: mineCount, icon: Users, tone: 'text-sky-600',
      on: () => setFilter(f => ({ ...f, assignee: profile.id, status: 'open', overdueOnly: false })) },
  ];

  // quick-filter pills:純粹換個介面去設「既有」filter state,未改 filteredTasks 邏輯
  const isAll = filter.status === '' && !filter.overdueOnly && filter.assignee === '';
  const pills: { key: string; label: string; n: number; active: boolean; on: () => void }[] = [
    { key: 'all', label: '全部', n: tasks.length, active: isAll,
      on: () => setFilter(f => ({ ...f, status: '', overdueOnly: false, assignee: '' })) },
    { key: 'open', label: '未完成', n: openCount, active: filter.status === 'open' && !filter.overdueOnly,
      on: () => setFilter(f => ({ ...f, status: 'open', overdueOnly: false })) },
    { key: 'overdue', label: '逾期', n: overdueCount, active: filter.overdueOnly,
      on: () => setFilter(f => ({ ...f, overdueOnly: true, status: 'open' })) },
    { key: 'mine', label: '我的', n: mineCount, active: filter.assignee === profile.id,
      on: () => setFilter(f => ({ ...f, assignee: profile.id })) },
    { key: 'todo', label: '待辦', n: tasks.filter(t => t.status === 'todo').length, active: filter.status === 'todo',
      on: () => setFilter(f => ({ ...f, status: 'todo', overdueOnly: false })) },
    { key: 'doing', label: '進行中', n: tasks.filter(t => t.status === 'doing').length, active: filter.status === 'doing',
      on: () => setFilter(f => ({ ...f, status: 'doing', overdueOnly: false })) },
    { key: 'done', label: '完成', n: tasks.filter(t => t.status === 'done').length, active: filter.status === 'done',
      on: () => setFilter(f => ({ ...f, status: 'done', overdueOnly: false })) },
  ];

  return (
    <div className="space-y-4 text-zinc-950">
      {/* 統計卡帶(/v2b 風;可點擊套既有篩選) */}
      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="grid grid-cols-2 divide-zinc-100 lg:grid-cols-4 lg:divide-x">
          {stats.map(s => {
            const inner = (
              <>
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-zinc-400">
                  <s.icon className={cn('h-3.5 w-3.5', s.tone)} />
                  {s.label}
                </div>
                <div className={cn('mt-1 text-2xl font-semibold tabular-nums', s.tone)}>{s.value}</div>
                <div className="text-xs text-zinc-400">{s.on ? <span className="text-sky-600">點擊篩選 ›</span> : '概覽'}</div>
              </>
            );
            return s.on ? (
              <button key={s.label} type="button" onClick={s.on}
                className="border-b border-zinc-100 px-4 py-3.5 text-left transition-colors hover:bg-zinc-50 lg:border-b-0">
                {inner}
              </button>
            ) : (
              <div key={s.label} className="border-b border-zinc-100 px-4 py-3.5 lg:border-b-0">{inner}</div>
            );
          })}
        </div>
      </section>

      {/* 工具列 + quick pills + 新增表單 */}
      <section className="rounded-xl border border-zinc-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 p-3">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={filter.search}
              onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
              placeholder="搜尋任務、客戶、內容"
              className="h-9 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400"
            />
          </div>
          <select value={filter.dealId} onChange={e => setFilter(f => ({ ...f, dealId: e.target.value }))}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-700 outline-none focus:border-zinc-400">
            <option value="">全部案件</option>
            {deals.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={groupBy} onChange={e => setGroupBy(e.target.value as 'assignee' | 'status' | 'none')}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-700 outline-none focus:border-zinc-400">
            <option value="assignee">分組:指派人</option>
            <option value="status">分組:狀態</option>
            <option value="none">不分組</option>
          </select>
          <button onClick={() => setShowNew(v => !v)}
            className={cn(
              'flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold',
              showNew ? 'border border-zinc-200 text-zinc-600 hover:border-zinc-300' : 'bg-zinc-950 text-white hover:bg-zinc-800',
            )}>
            {showNew ? <><X className="h-3.5 w-3.5" /> 關閉</> : <><Plus className="h-3.5 w-3.5" /> 新增任務</>}
          </button>
        </div>

        {/* quick-filter pills(含計數) */}
        <div className="flex flex-wrap gap-1.5 border-t border-zinc-100 px-3 py-2.5">
          {pills.map(p => (
            <button key={p.key} type="button" onClick={p.on}
              className={cn(
                'flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                p.active ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300',
              )}>
              {p.label}
              <span className={cn('tabular-nums', p.active ? 'text-zinc-300' : 'text-zinc-400')}>{p.n}</span>
            </button>
          ))}
        </div>

        {showNew && (
          <div className="space-y-2 border-t border-zinc-100 bg-sky-50/50 p-3">
            <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
              placeholder="任務標題（例:約王董夫妻下週三餐敘）"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400" />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
              <select value={newDealId} onChange={e => setNewDealId(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-700 outline-none focus:border-zinc-400">
                <option value="">關聯客戶（可選）</option>
                {deals.filter(d => d.stage !== 'L7').map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select value={newAssigneeId} onChange={e => setNewAssigneeId(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-700 outline-none focus:border-zinc-400">
                <option value="">未指派</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
              </select>
              <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-700 outline-none focus:border-zinc-400" />
              <select value={newPriority} onChange={e => setNewPriority(e.target.value as TaskPriority)}
                className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-700 outline-none focus:border-zinc-400">
                <option value="low">低優先</option>
                <option value="normal">中優先</option>
                <option value="high">高優先</option>
              </select>
            </div>
            <button onClick={submitNew} disabled={adding}
              className="flex w-full items-center justify-center gap-1 rounded-lg bg-zinc-950 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">
              {adding ? '新增中…' : <><CheckCircle2 className="h-4 w-4" /> 建立任務</>}
            </button>
          </div>
        )}
      </section>

      {/* 任務列表:/v2b 群組 + 固定欄位 */}
      <section className="space-y-4">
        {Object.keys(grouped).length === 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white py-10 text-center text-sm text-zinc-400">
            {tasks.length === 0 ? '還沒有任務,點「新增任務」開始' : '沒有符合條件的任務'}
          </div>
        )}
        {Object.entries(grouped).map(([groupName, items]) => (
          <div key={groupName} className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            {/* 群組頭像列(/v2b 風) */}
            <div className="flex items-center gap-2.5 border-b border-zinc-100 bg-zinc-50/80 px-4 py-2.5">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-600">
                {groupName.slice(0, 1)}
              </span>
              <span className="text-sm font-semibold text-zinc-900">{groupName}</span>
              <span className="ml-auto text-xs tabular-nums text-zinc-500">
                {items.length} 件 · {items.filter(t => t.status === 'done').length} 完成
              </span>
            </div>
            {/* 欄位表頭(lg) */}
            <div className={cn('hidden border-b border-zinc-100 bg-zinc-50/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400', GRID)}>
              <span />
              <span>任務／客戶</span>
              <span>到期</span>
              <span>優先</span>
              <span>進度</span>
              <span />
            </div>
            <ul className="divide-y divide-zinc-100">
              {items.map(t => {
                const deal = deals.find(d => d.id === t.deal_id);
                const dueDays = daysUntil(t.due_date);
                const isDone = t.status === 'done';
                const isOverdue = dueDays !== null && dueDays < 0 && !isDone;
                const isDueSoon = dueDays !== null && dueDays >= 0 && dueDays <= 3 && !isDone;
                const barTone = isDone
                  ? 'border-l-emerald-400'
                  : isOverdue
                    ? 'border-l-rose-400'
                    : isDueSoon
                      ? 'border-l-amber-400'
                      : 'border-l-zinc-200';
                return (
                  <li
                    key={t.id}
                    className={cn(
                      'group border-l-[3px] px-4 py-3 hover:bg-zinc-50',
                      barTone,
                      GRID,
                      'gap-y-2',
                      isDone && 'opacity-60',
                    )}
                  >
                    {/* 勾完成 */}
                    <input
                      type="checkbox"
                      checked={isDone}
                      onChange={() => onUpdateTask(t.id, { status: t.status === 'done' ? 'todo' : 'done' })}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600"
                      title="勾選完成"
                    />
                    {/* 任務標題 + 客戶 + 指派人 + 來源 */}
                    <div className="min-w-0">
                      <input
                        type="text"
                        value={t.title}
                        onChange={e => onUpdateTask(t.id, { title: e.target.value })}
                        className={cn(
                          'w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold text-zinc-900 outline-none hover:border-zinc-200 focus:border-zinc-400',
                          isDone && 'text-zinc-400 line-through',
                        )}
                      />
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-xs">
                        {deal && (
                          <button onClick={() => onOpenDeal(deal.id)}
                            className="inline-flex items-center gap-1 font-medium text-sky-700 hover:underline">
                            <Link2 className="h-3 w-3" />{deal.name}
                          </button>
                        )}
                        <select
                          value={t.assignee_id ?? ''}
                          onChange={e => onUpdateTask(t.id, { assignee_id: e.target.value || null })}
                          className="rounded-md border border-transparent bg-transparent px-1 py-0.5 text-zinc-500 outline-none hover:border-zinc-200 focus:border-zinc-400"
                          title="指派人"
                        >
                          <option value="">未指派</option>
                          {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
                        </select>
                        {t.source_type !== 'manual' && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
                            {t.source_type === 'deal_next_step'
                              ? <><Link2 className="h-3 w-3" /> 來自漏斗</>
                              : <><Sparkles className="h-3 w-3" /> 來自 AI 規劃</>}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* 到期:badge + 可改日期 */}
                    <div className="flex flex-col gap-0.5">
                      {dueDays !== null && !isDone && (
                        <span className={cn(
                          'w-fit rounded px-1.5 py-0.5 text-[11px] font-semibold',
                          isOverdue ? 'bg-rose-50 text-rose-700' : isDueSoon ? 'bg-amber-50 text-amber-700' : 'bg-zinc-100 text-zinc-500',
                        )}>
                          {isOverdue ? `逾期 ${Math.abs(dueDays)} 天` : dueDays === 0 ? '今天' : `${dueDays} 天後`}
                        </span>
                      )}
                      <input
                        type="date"
                        value={t.due_date ?? ''}
                        onChange={e => onUpdateTask(t.id, { due_date: e.target.value || null })}
                        className="rounded-md border border-transparent bg-transparent px-1 py-0.5 text-[11px] text-zinc-500 outline-none hover:border-zinc-200 focus:border-zinc-400"
                        title="到期日"
                      />
                    </div>
                    {/* 優先 */}
                    <select
                      value={t.priority}
                      onChange={e => onUpdateTask(t.id, { priority: e.target.value as TaskPriority })}
                      className={cn('w-fit cursor-pointer rounded border-none px-1.5 py-0.5 text-[11px] font-semibold outline-none', PRIORITY_PILL[t.priority])}
                      title="優先度"
                    >
                      <option value="low">低</option>
                      <option value="normal">中</option>
                      <option value="high">高</option>
                    </select>
                    {/* 進度 */}
                    <select
                      value={t.status}
                      onChange={e => onUpdateTask(t.id, { status: e.target.value as TaskStatus })}
                      className={cn('w-fit cursor-pointer rounded border-none px-1.5 py-0.5 text-[11px] font-semibold outline-none', STATUS_PILL[t.status])}
                      title="狀態"
                    >
                      <option value="todo">待辦</option>
                      <option value="doing">進行中</option>
                      <option value="done">完成</option>
                    </select>
                    {/* 刪除(hover 才出現) */}
                    <button
                      onClick={() => { if (confirm('刪除這個任務?')) onDeleteTask(t.id); }}
                      className="justify-self-start text-zinc-300 opacity-0 transition-opacity hover:text-rose-600 group-hover:opacity-100 lg:justify-self-end"
                      title="刪除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
