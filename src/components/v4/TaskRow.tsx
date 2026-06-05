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
import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trash2, Check, Users, Sparkles } from 'lucide-react';
import type { Task, TaskStatus, TaskPriority, Snapshot } from '@/lib/v4/types';
import { cn, daysUntil } from '@/lib/v4/utils';
import { patchTask, deleteTask, createTask } from '@/lib/v4/mutations';
import { InlineText } from '@/components/v4/InlineEdit';

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

const CONTROL_BASE = 'rounded-sm border px-1.5 py-0.5 font-v4-mono text-[10px] outline-none transition';

// 協作者多選 picker:按鈕顯示「協作 N」,點開是成員勾選清單。
// exclude:主責人 id —— 不在協作者清單中重複出現。
function ParticipantPicker({
  profiles, value, exclude, disabled, onChange,
}: {
  profiles: { id: string; full_name?: string | null; email: string }[];
  value: string[];
  exclude?: string | null;
  disabled?: boolean;
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const selectable = profiles.filter((p) => p.id !== exclude);
  const count = value.filter((id) => id !== exclude).length;

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        title="協作者(一起討論/開會,會收到行事曆邀請)"
        className={cn(
          CONTROL_BASE, 'inline-flex items-center gap-1 border-ink/15 bg-paper',
          count > 0 ? 'text-ink/80' : 'text-ink/65',
          disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:border-ink/40',
        )}
      >
        <Users className="h-3 w-3" strokeWidth={2} />
        {count > 0 ? `協作 ${count}` : '協作者'}
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-1 max-h-56 w-52 overflow-auto rounded-md border border-ink/15 bg-paper p-1 shadow-lg">
          {selectable.length === 0 && (
            <div className="px-2 py-1.5 text-[11px] text-ink/45">沒有其他成員可加入</div>
          )}
          {selectable.map((p) => (
            <label
              key={p.id}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-[11px] text-ink/75 hover:bg-ink/5"
            >
              <input
                type="checkbox"
                checked={value.includes(p.id)}
                onChange={() => toggle(p.id)}
                className="accent-cobalt"
              />
              <span className="truncate">{p.full_name || p.email}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// 時間下拉:時 + 分(每 10 分一格)。用 <select> 取代 native time input,
// 解決兩件事:(1) 分鐘只出現 00/10/20/30/40/50;(2) 整個欄位都可點開(不必對準時鐘 icon)。
// value / onChange 用 'HH:MM' 字串(或 null = 未設)。選時但未選分 → 預設 00 分。
// minHour / maxHour 限制可選的小時(例如開始時間只給 8–19)。
const MINUTE_OPTIONS = ['00', '10', '20', '30', '40', '50'];

function TimeSelect({
  value, onChange, disabled, selectClassName, title, minHour = 0, maxHour = 23,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  disabled?: boolean;
  selectClassName?: string;
  title?: string;
  minHour?: number;
  maxHour?: number;
}) {
  const hourOptions = Array.from(
    { length: Math.max(0, maxHour - minHour + 1) },
    (_, i) => String(minHour + i).padStart(2, '0'),
  );
  const hh = value ? value.slice(0, 2) : '';
  const mmRaw = value ? value.slice(3, 5) : '';
  // 既有資料若非 10 分整(例如舊的 :35),顯示退回 00,待使用者重選;不主動改 DB。
  const mm = MINUTE_OPTIONS.includes(mmRaw) ? mmRaw : value ? '00' : '';

  return (
    <span className="inline-flex items-center gap-0.5" title={title}>
      <select
        disabled={disabled}
        value={hh}
        onChange={(e) => onChange(e.target.value ? `${e.target.value}:${mm || '00'}` : null)}
        className={selectClassName}
        aria-label="小時"
      >
        <option value="">時</option>
        {hourOptions.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <span className="font-v4-mono text-[10px] text-ink/40">:</span>
      <select
        disabled={disabled || !hh}
        value={mm}
        onChange={(e) => onChange(`${hh || '00'}:${e.target.value || '00'}`)}
        className={selectClassName}
        aria-label="分鐘"
      >
        <option value="">分</option>
        {MINUTE_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
    </span>
  );
}

// 建議開會時段:選了協作人就自動查與會者(主責人 + 協作者)的 Google
// free/busy,從現在的下一個半天往後,列出最近 5 個大家都有空的時段(含日期)。
// 點某個時段即把日期 + 開始/結束時間一次填入。
const DURATION_OPTIONS = [30, 60, 90];

// 'YYYY-MM-DD' → 今天 / 明天 / M/D(週X)
function dateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return '今天';
  if (diff === 1) return '明天';
  const wd = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}(週${wd})`;
}

function FreeSlotSuggester({
  attendeeIds, onPick,
}: {
  attendeeIds: string[];
  onPick: (date: string, start: string, end: string) => void;
}) {
  const [duration, setDuration] = useState(60);
  const [loading, setLoading] = useState(false);
  const [slots, setSlots] = useState<{ date: string; start: string; end: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const key = attendeeIds.join(',');
  // 自動查:與會者或時長變動 → debounce 500ms 後查(避免每點一人就打一次 API)
  useEffect(() => {
    if (!attendeeIds.length) { setSlots([]); setMsg(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true); setMsg(null);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/calendar/free-slots', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ attendeeIds, durationMin: duration }),
        });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) { setSlots([]); setMsg(json.error || '查詢失敗'); return; }
        setSlots(json.slots ?? []);
        setMsg(!json.slots?.length ? (json.note || '近期工作時段內找不到大家都有空的時段') : (json.note ?? null));
      } catch {
        if (!cancelled) { setSlots([]); setMsg('查詢失敗,請稍後再試'); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
    // attendeeIds 以 key(join 字串)代表,避免陣列每次 render 都換 identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, duration]);

  if (!attendeeIds.length) return null;

  return (
    <div className="rounded-md border border-cobalt/20 bg-cobalt/5 p-2.5">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-cobalt" strokeWidth={2} />
        <span className="text-xs font-semibold text-cobalt">建議開會時段</span>
        <div className="ml-auto flex items-center gap-1">
          {DURATION_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDuration(d)}
              className={cn(
                'rounded-sm border px-1.5 py-0.5 font-v4-mono text-[10px] transition',
                d === duration ? 'border-cobalt/40 bg-cobalt/10 text-cobalt' : 'border-ink/15 text-ink/55 hover:border-ink/35',
              )}
            >
              {d}分
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="px-1 py-1.5 text-[11px] text-ink/45">查詢同事行事曆中…</div>
      ) : slots.length ? (
        <div className="flex flex-wrap gap-1.5">
          {slots.map((s, i) => (
            <button
              key={`${s.date}-${s.start}`}
              type="button"
              onClick={() => onPick(s.date, s.start, s.end)}
              title="填入此日期與時間"
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition',
                i === 0
                  ? 'border-cobalt/50 bg-cobalt/10 font-semibold text-cobalt'
                  : 'border-ink/15 bg-paper text-ink/70 hover:border-cobalt/40 hover:bg-cobalt/5',
              )}
            >
              <span className="font-v4-mono">{dateLabel(s.date)} {s.start}–{s.end}</span>
              {i === 0 && <span className="text-[9px] text-cobalt/80">最推薦</span>}
            </button>
          ))}
        </div>
      ) : null}
      {msg && <div className="mt-1.5 px-1 text-[10.5px] text-ink/50">{msg}</div>}
    </div>
  );
}

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
  const router = useRouter();
  const [, startTransition] = useTransition();
  // tmp 任務(id 開頭 'tmp-')尚未從 DB 拿到真 id,不能對它做 patch/delete
  // 否則 patchTask(tmpId) 在 DB 完全找不到 row。等 swap 完才解鎖。
  const pending = task.id.startsWith('tmp-');
  // shadow state — 點下去立刻顯示新值
  const [localStatus, setLocalStatus] = useState<TaskStatus>(task.status);
  const [localPriority, setLocalPriority] = useState<TaskPriority>(task.priority);
  const [localAssignee, setLocalAssignee] = useState<string | null>(task.assignee_id);
  const [localParticipants, setLocalParticipants] = useState<string[]>(task.participant_ids ?? []);
  const [localDue, setLocalDue] = useState<string | null>(task.due_date);
  const [localStart, setLocalStart] = useState<string | null>(task.start_time ?? null);
  const [localEnd, setLocalEnd] = useState<string | null>(task.end_time ?? null);
  const [removed, setRemoved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { setLocalStatus(task.status); }, [task.status]);
  useEffect(() => { setLocalPriority(task.priority); }, [task.priority]);
  useEffect(() => { setLocalAssignee(task.assignee_id); }, [task.assignee_id]);
  useEffect(() => { setLocalParticipants(task.participant_ids ?? []); }, [task.participant_ids]);
  useEffect(() => { setLocalDue(task.due_date); }, [task.due_date]);
  useEffect(() => { setLocalStart(task.start_time ?? null); }, [task.start_time]);
  useEffect(() => { setLocalEnd(task.end_time ?? null); }, [task.end_time]);

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
    patchTask(task.id, { assignee_id: next })
      // 改派會影響別頁分組(我的任務),主動刷新使快取失效、跨頁同步(Realtime 在 preview 未推播)
      .then(() => startTransition(() => router.refresh()))
      .catch((e) => {
        setLocalAssignee(prev);
        onLocalPatch?.(task.id, { assignee_id: prev });
        setErr((e as Error).message);
      });
  }

  function changeParticipants(next: string[]) {
    if (!guard()) return;
    const prev = localParticipants;
    setLocalParticipants(next);
    onLocalPatch?.(task.id, { participant_ids: next });
    setErr(null);
    patchTask(task.id, { participant_ids: next })
      .catch((e) => {
        setLocalParticipants(prev);
        onLocalPatch?.(task.id, { participant_ids: prev });
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

  function changeStart(next: string | null) {
    if (!guard()) return;
    const prev = localStart;
    setLocalStart(next);
    onLocalPatch?.(task.id, { start_time: next });
    setErr(null);
    patchTask(task.id, { start_time: next }).catch((e) => {
      setLocalStart(prev);
      onLocalPatch?.(task.id, { start_time: prev });
      setErr((e as Error).message);
    });
  }

  function changeEnd(next: string | null) {
    if (!guard()) return;
    const prev = localEnd;
    setLocalEnd(next);
    onLocalPatch?.(task.id, { end_time: next });
    setErr(null);
    patchTask(task.id, { end_time: next }).catch((e) => {
      setLocalEnd(prev);
      onLocalPatch?.(task.id, { end_time: prev });
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

  const controlBase = CONTROL_BASE;

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
        <InlineText
          value={task.title}
          onSave={async (next) => {
            const title = next.trim();
            if (!title) throw new Error('標題不可空白');
            onLocalPatch?.(task.id, { title });
            await patchTask(task.id, { title });
          }}
          isFixtures={locked}
          displayClassName={cn('font-v4-serif text-base font-medium', done ? 'text-ink/45 line-through' : 'text-ink')}
        />
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

          {/* 協作者(多人;主責人 + 協作者都會成為行事曆與會者) */}
          <ParticipantPicker
            profiles={snapshot.profiles}
            value={localParticipants}
            exclude={localAssignee}
            disabled={locked}
            onChange={changeParticipants}
          />

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

          {/* 時間段(可選;不填則整天) */}
          <TimeSelect
            value={localStart}
            onChange={changeStart}
            disabled={locked || !localDue}
            minHour={8}
            maxHour={19}
            title={localDue ? '開始時間 8:00–19:00(不填=整天工作)' : '先設到期日才能設時間'}
            selectClassName={cn(
              controlBase, 'border-ink/15 bg-paper text-ink/65',
              locked || !localDue ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-ink/40',
            )}
          />
          {localStart && (
            <>
              <span className="font-v4-mono text-[10px] text-ink/40">~</span>
              <TimeSelect
                value={localEnd}
                onChange={changeEnd}
                disabled={locked || !localDue}
                minHour={8}
                maxHour={20}
                title="結束時間(不填=開始 +1 小時)"
                selectClassName={cn(
                  controlBase, 'border-ink/15 bg-paper text-ink/65',
                  locked || !localDue ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-ink/40',
                )}
              />
            </>
          )}

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
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  function submit() {
    if (!title.trim()) return;
    if (isFixtures) { setErr('fixtures 模式無法寫入'); return; }

    const titleVal = title.trim();
    const dueVal = dueDate || null;
    // 時間只有在有到期日時才有意義;沒結束時間就交給後端預設 +1 小時
    const startVal = dueVal ? (startTime || null) : null;
    const endVal = startVal ? (endTime || null) : null;
    const priVal = priority;
    const linkedDeal = dealId || null;
    const assignee = assigneeId || null;
    // 主責人不重複列入協作者
    const participants = participantIds.filter((id) => id !== assignee);

    // 樂觀:立刻給父層一筆 tmp 任務 + 收起 composer
    const tmpTask: Task = {
      id: `tmp-${Date.now()}`,
      deal_id: linkedDeal,
      title: titleVal,
      description: '',
      assignee_id: assignee,
      participant_ids: participants,
      due_date: dueVal,
      start_time: startVal,
      end_time: endVal,
      status: 'todo',
      priority: priVal,
      created_at: new Date().toISOString(),
      completed_at: null,
    };
    onCreated?.(tmpTask);
    setTitle(''); setAssigneeId(''); setParticipantIds([]); setDueDate(''); setStartTime(''); setEndTime(''); setPriority('normal'); setExpanded(false);
    setErr(null);

    // DB 寫入背景跑;成功就把 tmp id 換成真 id(後續 toggle/delete 才打得到 row),
    // 失敗就告訴父層把 tmp row 從列表移除
    createTask({
      deal_id: linkedDeal,
      title: titleVal,
      assignee_id: assignee,
      participant_ids: participants,
      due_date: dueVal,
      start_time: startVal,
      end_time: endVal,
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
        <ParticipantPicker
          profiles={snapshot.profiles}
          value={participantIds}
          exclude={assigneeId || null}
          onChange={setParticipantIds}
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className={cn(fieldCls, 'font-v4-mono')}
        />
        <TimeSelect
          value={startTime || null}
          onChange={(v) => setStartTime(v ?? '')}
          disabled={!dueDate}
          minHour={8}
          maxHour={19}
          title={dueDate ? '開始時間 8:00–19:00(不填=整天工作)' : '先設到期日才能設時間'}
          selectClassName={cn(fieldCls, 'font-v4-mono', !dueDate && 'cursor-not-allowed opacity-50')}
        />
        {startTime && (
          <>
            <span className="font-v4-mono text-[10px] text-ink/40">~</span>
            <TimeSelect
              value={endTime || null}
              onChange={(v) => setEndTime(v ?? '')}
              minHour={8}
              maxHour={20}
              title="結束時間(不填=開始 +1 小時)"
              selectClassName={cn(fieldCls, 'font-v4-mono')}
            />
          </>
        )}
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
      {/* 有選協作人(代表要開會)才自動推薦大家都有空的日期+時段;點一下填入到期日與時間 */}
      <FreeSlotSuggester
        attendeeIds={participantIds.length ? [assigneeId, ...participantIds].filter(Boolean) : []}
        onPick={(date, start, end) => { setDueDate(date); setStartTime(start); setEndTime(end); }}
      />
      {err && <div className="text-[11px] text-claret">{err}</div>}
      <div className="font-v4-mono text-[10.5px] text-ink/45">Enter 新增 · Esc 取消</div>
    </div>
  );
}
