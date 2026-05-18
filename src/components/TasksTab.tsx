'use client';

/**
 * TasksTab — 正式 v1 任務頁。
 *
 * 2026-05-18 視覺改造:外觀套用 /v2b（設計方向 B）設計語言
 *   bg/卡片 zinc-50·white·border-zinc-200·rounded-xl；風險 rose、跟進 amber、
 *   進度好 emerald、分析 sky；統計卡可點擊套用既有篩選；到期分級 badge + 左色條；
 *   可讀性放大、刪除 hover 才出現。
 *
 * 嚴格保留:Props 介面、@/lib/types、所有 callbacks（onAddTask/onUpdateTask/
 * onDeleteTask/onOpenDeal）、篩選/分組/列內即時編輯邏輯、真實資料流。
 * 僅改 presentation，未動任何資料/權限/Supabase 邏輯。
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
const STATUS_COLOR: Record<TaskStatus, string> = {
  todo: 'bg-zinc-100 text-zinc-600',
  doing: 'bg-sky-50 text-sky-700',
  done: 'bg-emerald-50 text-emerald-700',
};
const PRIORITY_COLOR: Record<TaskPriority, string> = {
  high: 'text-rose-600',
  normal: 'text-zinc-600',
  low: 'text-zinc-400',
};

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = (new Date(dateStr).getTime() - Date.now()) / 86400000;
  return Math.ceil(diff);
}

const SELECT_CLS =
  'rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-700 outline-none focus:border-zinc-400';
const INLINE_CLS =
  'rounded-md border border-transparent bg-transparent px-1 py-0.5 hover:border-zinc-200 focus:border-zinc-400 outline-none';

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

  const stats: { label: string; value: number; icon: typeof ClipboardList; tone: string; onClick?: () => void }[] = [
    {
      label: '未完成', value: openCount, icon: ClipboardList, tone: 'text-zinc-600',
      onClick: () => setFilter(f => ({ ...f, status: 'open', overdueOnly: false })),
    },
    {
      label: '已逾期', value: overdueCount, icon: AlertTriangle,
      tone: overdueCount > 0 ? 'text-rose-600' : 'text-emerald-600',
      onClick: () => setFilter(f => ({ ...f, overdueOnly: true, status: 'open' })),
    },
    {
      label: '本週到期', value: weekCount, icon: CalendarClock,
      tone: weekCount > 0 ? 'text-amber-600' : 'text-emerald-600',
    },
    {
      label: '我被指派', value: mineCount, icon: Users, tone: 'text-sky-600',
      onClick: () => setFilter(f => ({ ...f, assignee: profile.id, status: 'open', overdueOnly: false })),
    },
  ];

  return (
    <div className="space-y-4 text-zinc-950">
      {/* 任務概覽（可點擊套用既有篩選） */}
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
                {s.onClick ? <div className="text-xs text-sky-600">點擊篩選 ›</div> : <div className="text-xs text-zinc-300">概覽</div>}
              </>
            );
            return s.onClick ? (
              <button
                key={s.label}
                type="button"
                onClick={s.onClick}
                className="border-b border-zinc-100 px-4 py-3.5 text-left transition-colors hover:bg-zinc-50 lg:border-b-0"
              >
                {inner}
              </button>
            ) : (
              <div key={s.label} className="border-b border-zinc-100 px-4 py-3.5 lg:border-b-0">
                {inner}
              </div>
            );
          })}
        </div>
      </section>

      {/* 篩選 + 新增 */}
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
          <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value as TaskStatus | 'open' | '' }))}
            className={SELECT_CLS}>
            <option value="open">未完成</option>
            <option value="">全部狀態</option>
            <option value="todo">待辦</option>
            <option value="doing">進行中</option>
            <option value="done">已完成</option>
          </select>
          <select value={filter.assignee} onChange={e => setFilter(f => ({ ...f, assignee: e.target.value }))}
            className={SELECT_CLS}>
            <option value="">全部指派</option>
            <option value={profile.id}>我的任務</option>
            {profiles.filter(p => p.id !== profile.id).map(p => (
              <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
            ))}
          </select>
          <select value={filter.dealId} onChange={e => setFilter(f => ({ ...f, dealId: e.target.value }))}
            className={SELECT_CLS}>
            <option value="">全部案件</option>
            {deals.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <label className={cn(
            'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors',
            filter.overdueOnly ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300',
          )}>
            <input type="checkbox" checked={filter.overdueOnly} onChange={e => setFilter(f => ({ ...f, overdueOnly: e.target.checked }))} className="accent-rose-600" />
            <span>只看逾期</span>
          </label>
          <select value={groupBy} onChange={e => setGroupBy(e.target.value as 'assignee' | 'status' | 'none')}
            className={SELECT_CLS}>
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

        {/* 新任務表單 */}
        {showNew && (
          <div className="border-t border-zinc-100 bg-sky-50/50 p-3 space-y-2">
            <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
              placeholder="任務標題（例:約王董夫妻下週三餐敘）"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400" />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
              <select value={newDealId} onChange={e => setNewDealId(e.target.value)} className={SELECT_CLS}>
                <option value="">關聯客戶（可選）</option>
                {deals.filter(d => d.stage !== 'L7').map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <select value={newAssigneeId} onChange={e => setNewAssigneeId(e.target.value)} className={SELECT_CLS}>
                <option value="">未指派</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
              </select>
              <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)}
                className={SELECT_CLS} />
              <select value={newPriority} onChange={e => setNewPriority(e.target.value as TaskPriority)} className={SELECT_CLS}>
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

      {/* 任務列表（分組） */}
      <section className="space-y-4">
        {Object.keys(grouped).length === 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white py-10 text-center text-sm text-zinc-400">
            {tasks.length === 0 ? '還沒有任務,點「新增任務」開始' : '沒有符合條件的任務'}
          </div>
        )}
        {Object.entries(grouped).map(([groupName, items]) => (
          <div key={groupName} className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/80 px-4 py-2.5">
              <div className="text-sm font-semibold text-zinc-900">{groupName}</div>
              <div className="text-xs tabular-nums text-zinc-500">
                {items.length} 件 · {items.filter(t => t.status === 'done').length} 完成
              </div>
            </div>
            <ul className="divide-y divide-zinc-100">
              {items.map(t => {
                const deal = deals.find(d => d.id === t.deal_id);
                const dueDays = daysUntil(t.due_date);
                const isOverdue = dueDays !== null && dueDays < 0 && t.status !== 'done';
                const isDueSoon = dueDays !== null && dueDays >= 0 && dueDays <= 3 && t.status !== 'done';
                const isDone = t.status === 'done';
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
                      'group flex items-start gap-3 border-l-[3px] px-4 py-3 hover:bg-zinc-50',
                      barTone,
                      isDone && 'opacity-60',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isDone}
                      onChange={() => onUpdateTask(t.id, { status: t.status === 'done' ? 'todo' : 'done' })}
                      className="mt-1 h-4 w-4 shrink-0 accent-emerald-600"
                    />
                    <div className="min-w-0 flex-1">
                      <input
                        type="text"
                        value={t.title}
                        onChange={e => onUpdateTask(t.id, { title: e.target.value })}
                        className={cn(
                          'w-full text-sm font-semibold text-zinc-900',
                          INLINE_CLS,
                          isDone && 'text-zinc-400 line-through',
                        )}
                      />
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        {deal && (
                          <button
                            onClick={() => onOpenDeal(deal.id)}
                            className="inline-flex items-center gap-1 font-medium text-sky-700 hover:underline"
                          >
                            <Link2 className="h-3 w-3" />
                            {deal.name}
                          </button>
                        )}
                        <select
                          value={t.assignee_id ?? ''}
                          onChange={e => onUpdateTask(t.id, { assignee_id: e.target.value || null })}
                          className={cn('text-zinc-600', INLINE_CLS)}
                          title="指派人"
                        >
                          <option value="">未指派</option>
                          {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
                        </select>
                        <input
                          type="date"
                          value={t.due_date ?? ''}
                          onChange={e => onUpdateTask(t.id, { due_date: e.target.value || null })}
                          className={cn(
                            INLINE_CLS,
                            isOverdue ? 'font-medium text-rose-600' : isDueSoon ? 'text-amber-600' : 'text-zinc-500',
                          )}
                          title="到期日"
                        />
                        {dueDays !== null && !isDone && (
                          <span className={cn(
                            'rounded px-1.5 py-0.5 text-[11px] font-semibold',
                            isOverdue ? 'bg-rose-50 text-rose-700' : isDueSoon ? 'bg-amber-50 text-amber-700' : 'bg-zinc-100 text-zinc-500',
                          )}>
                            {isOverdue ? `逾期 ${Math.abs(dueDays)} 天` : dueDays === 0 ? '今天' : `${dueDays} 天後`}
                          </span>
                        )}
                        <select
                          value={t.priority}
                          onChange={e => onUpdateTask(t.id, { priority: e.target.value as TaskPriority })}
                          className={cn(INLINE_CLS, 'font-medium', PRIORITY_COLOR[t.priority])}
                          title="優先度"
                        >
                          <option value="low">低</option>
                          <option value="normal">中</option>
                          <option value="high">高</option>
                        </select>
                        <select
                          value={t.status}
                          onChange={e => onUpdateTask(t.id, { status: e.target.value as TaskStatus })}
                          className={cn('rounded border-none px-1.5 py-0.5 text-[11px] font-semibold outline-none', STATUS_COLOR[t.status])}
                          title="狀態"
                        >
                          <option value="todo">待辦</option>
                          <option value="doing">進行中</option>
                          <option value="done">完成</option>
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
                    <button
                      onClick={() => { if (confirm('刪除這個任務?')) onDeleteTask(t.id); }}
                      className="mt-0.5 shrink-0 text-zinc-300 opacity-0 transition-opacity hover:text-rose-600 group-hover:opacity-100"
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
