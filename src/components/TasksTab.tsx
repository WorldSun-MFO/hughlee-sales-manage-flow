'use client';

import { useMemo, useState } from 'react';
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
  todo: 'bg-slate-100 text-slate-700',
  doing: 'bg-indigo-100 text-indigo-700',
  done: 'bg-emerald-100 text-emerald-700',
};
const PRIORITY_LABEL: Record<TaskPriority, string> = { high: '高', normal: '中', low: '低' };
const PRIORITY_COLOR: Record<TaskPriority, string> = {
  high: 'text-rose-600',
  normal: 'text-slate-600',
  low: 'text-slate-400',
};

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = (new Date(dateStr).getTime() - Date.now()) / 86400000;
  return Math.ceil(diff);
}

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

  return (
    <div className="space-y-3">
      {/* 任務概覽 */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="text-xs text-slate-500">未完成</div>
          <div className="mt-1 text-2xl font-bold text-indigo-700">{openCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="text-xs text-slate-500">已逾期</div>
          <div className={`mt-1 text-2xl font-bold ${overdueCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{overdueCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="text-xs text-slate-500">本週到期</div>
          <div className="mt-1 text-2xl font-bold text-amber-600">
            {tasks.filter(t => {
              if (t.status === 'done') return false;
              const d = daysUntil(t.due_date);
              return d !== null && d >= 0 && d <= 7;
            }).length}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="text-xs text-slate-500">我被指派</div>
          <div className="mt-1 text-2xl font-bold text-slate-700">
            {tasks.filter(t => t.assignee_id === profile.id && t.status !== 'done').length}
          </div>
        </div>
      </section>

      {/* 篩選 + 新增 */}
      <section className="bg-white rounded-xl border border-slate-200 p-3 flex flex-wrap gap-2 items-center">
        <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value as TaskStatus | 'open' | '' }))}
          className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg bg-white">
          <option value="open">未完成</option>
          <option value="">全部狀態</option>
          <option value="todo">待辦</option>
          <option value="doing">進行中</option>
          <option value="done">已完成</option>
        </select>
        <select value={filter.assignee} onChange={e => setFilter(f => ({ ...f, assignee: e.target.value }))}
          className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg bg-white">
          <option value="">全部指派</option>
          <option value={profile.id}>我的任務</option>
          {profiles.filter(p => p.id !== profile.id).map(p => (
            <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
          ))}
        </select>
        <select value={filter.dealId} onChange={e => setFilter(f => ({ ...f, dealId: e.target.value }))}
          className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg bg-white">
          <option value="">全部案件</option>
          {deals.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <label className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
          <input type="checkbox" checked={filter.overdueOnly} onChange={e => setFilter(f => ({ ...f, overdueOnly: e.target.checked }))} className="accent-rose-600" />
          <span>⚠️ 只看逾期</span>
        </label>
        <input type="search" value={filter.search} onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
          placeholder="搜尋任務/客戶..."
          className="flex-1 min-w-[120px] px-2 py-1.5 text-sm border border-slate-200 rounded-lg" />
        <select value={groupBy} onChange={e => setGroupBy(e.target.value as 'assignee' | 'status' | 'none')}
          className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg bg-white">
          <option value="assignee">分組:指派人</option>
          <option value="status">分組:狀態</option>
          <option value="none">不分組</option>
        </select>
        <button onClick={() => setShowNew(v => !v)}
          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          {showNew ? '✕ 關閉' : '＋ 新增任務'}
        </button>
      </section>

      {/* 新任務表單 */}
      {showNew && (
        <section className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 space-y-2">
          <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
            placeholder="任務標題(例:約王董夫妻下週三餐敘)"
            className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <select value={newDealId} onChange={e => setNewDealId(e.target.value)}
              className="px-2 py-1.5 border border-slate-200 rounded text-sm bg-white">
              <option value="">關聯客戶(可選)</option>
              {deals.filter(d => d.stage !== 'L7').map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <select value={newAssigneeId} onChange={e => setNewAssigneeId(e.target.value)}
              className="px-2 py-1.5 border border-slate-200 rounded text-sm bg-white">
              <option value="">未指派</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
            </select>
            <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)}
              className="px-2 py-1.5 border border-slate-200 rounded text-sm" />
            <select value={newPriority} onChange={e => setNewPriority(e.target.value as TaskPriority)}
              className="px-2 py-1.5 border border-slate-200 rounded text-sm bg-white">
              <option value="low">低優先</option>
              <option value="normal">中優先</option>
              <option value="high">高優先</option>
            </select>
          </div>
          <button onClick={submitNew} disabled={adding}
            className="w-full py-1.5 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {adding ? '新增中...' : '✓ 建立任務'}
          </button>
        </section>
      )}

      {/* 任務列表(分組) */}
      <section className="space-y-3">
        {Object.keys(grouped).length === 0 && (
          <div className="text-center py-10 text-slate-400 text-sm bg-white rounded-xl border border-slate-200">
            {tasks.length === 0 ? '🎉 還沒有任務,點「＋ 新增任務」開始' : '沒有符合條件的任務'}
          </div>
        )}
        {Object.entries(grouped).map(([groupName, items]) => (
          <div key={groupName} className="bg-white rounded-xl border border-slate-200">
            <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-xl">
              <div className="font-semibold text-sm">{groupName}</div>
              <div className="text-xs text-slate-500">{items.length} 件 · {items.filter(t => t.status === 'done').length} 完成</div>
            </div>
            <ul className="divide-y divide-slate-100">
              {items.map(t => {
                const deal = deals.find(d => d.id === t.deal_id);
                const dueDays = daysUntil(t.due_date);
                const isOverdue = dueDays !== null && dueDays < 0 && t.status !== 'done';
                const isDueSoon = dueDays !== null && dueDays >= 0 && dueDays <= 3 && t.status !== 'done';
                return (
                  <li key={t.id} className={`p-2 flex items-start gap-2 hover:bg-slate-50 ${t.status === 'done' ? 'opacity-60' : ''}`}>
                    <input
                      type="checkbox"
                      checked={t.status === 'done'}
                      onChange={() => onUpdateTask(t.id, { status: t.status === 'done' ? 'todo' : 'done' })}
                      className="mt-1.5 accent-emerald-600"
                    />
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={t.title}
                        onChange={e => onUpdateTask(t.id, { title: e.target.value })}
                        className={`w-full px-1 py-0.5 text-sm border border-transparent hover:border-slate-200 rounded ${t.status === 'done' ? 'line-through text-slate-400' : ''}`}
                      />
                      <div className="mt-0.5 flex items-center gap-2 flex-wrap text-xs">
                        {deal && (
                          <button onClick={() => onOpenDeal(deal.id)} className="text-indigo-600 hover:underline">
                            👤 {deal.name}
                          </button>
                        )}
                        <select
                          value={t.assignee_id ?? ''}
                          onChange={e => onUpdateTask(t.id, { assignee_id: e.target.value || null })}
                          className="px-1 py-0.5 border border-transparent hover:border-slate-200 rounded bg-transparent"
                        >
                          <option value="">未指派</option>
                          {profiles.map(p => <option key={p.id} value={p.id}>👥 {p.full_name || p.email}</option>)}
                        </select>
                        <input
                          type="date"
                          value={t.due_date ?? ''}
                          onChange={e => onUpdateTask(t.id, { due_date: e.target.value || null })}
                          className={`px-1 py-0.5 border border-transparent hover:border-slate-200 rounded ${isOverdue ? 'text-rose-600 font-medium' : isDueSoon ? 'text-amber-600' : 'text-slate-500'}`}
                        />
                        {dueDays !== null && t.status !== 'done' && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${isOverdue ? 'bg-rose-100 text-rose-700' : isDueSoon ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                            {isOverdue ? `逾期 ${Math.abs(dueDays)} 天` : dueDays === 0 ? '今天' : `${dueDays} 天後`}
                          </span>
                        )}
                        <select
                          value={t.priority}
                          onChange={e => onUpdateTask(t.id, { priority: e.target.value as TaskPriority })}
                          className={`px-1 py-0.5 border border-transparent hover:border-slate-200 rounded bg-transparent ${PRIORITY_COLOR[t.priority]}`}
                          title="優先度"
                        >
                          <option value="low">低</option>
                          <option value="normal">中</option>
                          <option value="high">高</option>
                        </select>
                        <select
                          value={t.status}
                          onChange={e => onUpdateTask(t.id, { status: e.target.value as TaskStatus })}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded border-none ${STATUS_COLOR[t.status]}`}
                        >
                          <option value="todo">待辦</option>
                          <option value="doing">進行中</option>
                          <option value="done">完成</option>
                        </select>
                        {t.source_type !== 'manual' && (
                          <span className="text-[10px] text-slate-400">
                            {t.source_type === 'deal_next_step' ? '🔗 來自漏斗' : '🎯 來自 AI 規劃'}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => { if (confirm('刪除這個任務?')) onDeleteTask(t.id); }}
                      className="text-rose-400 hover:text-rose-600 text-xs px-1"
                      title="刪除"
                    >🗑</button>
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
