'use client';

// ============================================================
// Inline edit 元件群 — v4.2 樂觀修改版
// ============================================================
// 行為改變:
//   v4.1: commit() 是 await → 等 DB 回來才退出編輯模式 + 顯示 = prop value
//         (因為沒有 router.refresh,顯示永遠是「上一次 server 給的舊值」)
//   v4.2: commit() 立刻退出編輯模式 + shadow 立刻設成新值;
//         DB 寫入背景跑(fire-and-forget),失敗才回滾 shadow + 顯示錯誤
//
//   shadow = 「我目前該顯示的值」,優先 trust 自己的編輯
//   prop value 變動時(例如其他 view 改了 / realtime 推回)同步 shadow
//
// 5 個元件:InlineText / InlineTextarea / InlineSelect / InlineDate / InlineScore
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Pencil, X } from 'lucide-react';
import { cn, fmtMoney } from '@/lib/v4/utils';

type SaveFn<T> = (next: T) => Promise<void>;

// ---------------- Inline single-line text ----------------
export function InlineText({
  value, onSave, isFixtures, placeholder, className, displayClassName,
}: {
  value: string;
  onSave: SaveFn<string>;
  isFixtures: boolean;
  placeholder?: string;
  className?: string;
  displayClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [shadow, setShadow] = useState(value);   // 樂觀顯示值
  const [draft, setDraft] = useState(value);     // 編輯中的暫存
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // prop 變動時(外部 fresh data)同步 shadow + draft
  useEffect(() => { setShadow(value); setDraft(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  function commit() {
    const next = draft.trim();
    if (next === shadow) { setEditing(false); return; }
    // 樂觀:立刻把 shadow 換成新值,退出編輯模式
    setShadow(next);
    setEditing(false);
    setBusy(true); setErr(null);
    onSave(next)
      .catch((e) => { setShadow(value); setDraft(value); setErr((e as Error).message); })
      .finally(() => setBusy(false));
  }

  if (!editing) {
    return (
      <DisplayShell isFixtures={isFixtures} onEdit={() => setEditing(true)} className={cn('block', className)}>
        <span className={cn('text-ink', !shadow && 'italic text-ink/45', displayClassName)}>{shadow || (placeholder ?? '—')}</span>
        {busy && <Loader2 className="absolute right-7 top-2 h-3 w-3 animate-spin text-ink/40" strokeWidth={2} />}
        {err && <div className="text-[11px] text-claret">{err}</div>}
      </DisplayShell>
    );
  }
  return (
    <div className={cn('grid gap-1', className)}>
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(shadow); setEditing(false); } }}
        onBlur={commit}
        className="rounded-md border border-ink/30 bg-cream/40 px-2.5 py-1.5 text-sm text-ink focus:border-ink/50 focus:outline-none"
      />
    </div>
  );
}

// ---------------- Inline textarea ----------------
export function InlineTextarea({
  value, onSave, isFixtures, placeholder, rows = 3, className, displayClassName,
}: {
  value: string | null;
  onSave: SaveFn<string | null>;
  isFixtures: boolean;
  placeholder?: string;
  rows?: number;
  className?: string;
  displayClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [shadow, setShadow] = useState<string | null>(value);
  const [draft, setDraft] = useState(value ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setShadow(value); setDraft(value ?? ''); }, [value]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  function commit() {
    const next = draft.trim() || null;
    if (next === shadow) { setEditing(false); return; }
    setShadow(next);
    setEditing(false);
    setBusy(true); setErr(null);
    onSave(next)
      .catch((e) => { setShadow(value); setDraft(value ?? ''); setErr((e as Error).message); })
      .finally(() => setBusy(false));
  }
  function cancel() { setDraft(shadow ?? ''); setEditing(false); setErr(null); }

  if (!editing) {
    return (
      <DisplayShell isFixtures={isFixtures} onEdit={() => setEditing(true)} className={className}>
        <div className={cn('whitespace-pre-wrap text-ink', !shadow && 'italic text-ink/45', displayClassName)}>
          {shadow || (placeholder ?? '—')}
        </div>
        {busy && <Loader2 className="absolute right-7 top-2 h-3 w-3 animate-spin text-ink/40" strokeWidth={2} />}
        {err && <div className="text-[11px] text-claret">{err}</div>}
      </DisplayShell>
    );
  }
  return (
    <div className={cn('grid gap-2', className)}>
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        }}
        rows={rows}
        className="w-full resize-vertical rounded-md border border-ink/30 bg-cream/40 px-3 py-2 text-sm leading-6 text-ink focus:border-ink/50 focus:outline-none"
      />
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={cancel} className="inline-flex items-center gap-1 rounded-md border border-ink/15 bg-paper px-2.5 py-1 text-xs text-ink/65 hover:border-ink/30">
          <X className="h-3 w-3" strokeWidth={2} /> 取消
        </button>
        <button type="button" onClick={commit} className="inline-flex items-center gap-1 rounded-md bg-ink px-2.5 py-1 text-xs font-semibold text-paper hover:bg-graphite">
          <Check className="h-3 w-3" strokeWidth={2} /> 儲存
        </button>
      </div>
      <div className="font-v4-mono text-[10.5px] text-ink/45">Cmd/Ctrl + Enter 儲存 · Esc 取消</div>
    </div>
  );
}

// ---------------- Inline select ----------------
export function InlineSelect<T extends string>({
  value, options, onSave, isFixtures, renderDisplay, className,
}: {
  value: T | null;
  options: ReadonlyArray<{ value: T; label: string }>;
  onSave: SaveFn<T | null>;
  isFixtures: boolean;
  renderDisplay?: (v: T | null) => React.ReactNode;
  className?: string;
}) {
  const [shadow, setShadow] = useState<T | null>(value);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const selfRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setShadow(value); }, [value]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!selfRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  function pick(next: T | null) {
    setOpen(false);
    if (next === shadow) return;
    setShadow(next);  // 樂觀
    setBusy(true); setErr(null);
    onSave(next)
      .catch((e) => { setShadow(value); setErr((e as Error).message); })
      .finally(() => setBusy(false));
  }

  return (
    <div ref={selfRef} className={cn('relative inline-flex flex-col gap-1', className)}>
      <button
        type="button"
        onClick={() => !isFixtures && setOpen((v) => !v)}
        disabled={isFixtures}
        className={cn(
          'group inline-flex items-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm transition hover:border-ink/15 hover:bg-cream/40',
          isFixtures && 'cursor-not-allowed opacity-70',
        )}
      >
        {renderDisplay ? renderDisplay(shadow) : <span className="font-v4-mono font-semibold text-ink">{options.find((o) => o.value === shadow)?.label ?? '—'}</span>}
        {busy ? <Loader2 className="h-3 w-3 animate-spin text-ink/40" strokeWidth={2} /> : !isFixtures && <Pencil className="h-3 w-3 text-ink/30 opacity-0 transition group-hover:opacity-100" strokeWidth={2} />}
      </button>
      {open && (
        <ul className="absolute left-0 top-full z-10 mt-1 grid min-w-[180px] gap-0.5 rounded-md border border-ink/15 bg-paper p-1 shadow-panel">
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                onClick={() => pick(o.value)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm transition',
                  o.value === shadow ? 'bg-ink text-paper' : 'text-ink hover:bg-cream/60',
                )}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {err && <div className="text-[11px] text-claret">{err}</div>}
    </div>
  );
}

// ---------------- Inline date ----------------
export function InlineDate({
  value, onSave, isFixtures, className,
}: {
  value: string | null;
  onSave: SaveFn<string | null>;
  isFixtures: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [shadow, setShadow] = useState<string | null>(value);
  const [draft, setDraft] = useState(value ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setShadow(value); setDraft(value ?? ''); }, [value]);
  // 進入編輯就直接彈出原生行事曆,不用再點一次輸入框(showPicker 在點擊觸發的
  // activation 視窗內有效;不支援的瀏覽器退回原本「點輸入框開啟」)。
  useEffect(() => {
    if (!editing) return;
    const el = ref.current;
    el?.focus();
    try { el?.showPicker?.(); } catch { /* 非使用者手勢 / 不支援時略過 */ }
  }, [editing]);

  function commit(next: string) {
    const nextVal = next || null;
    if (nextVal === shadow) { setEditing(false); return; }
    setShadow(nextVal);
    setEditing(false);
    setBusy(true); setErr(null);
    onSave(nextVal)
      .catch((e) => { setShadow(value); setDraft(value ?? ''); setErr((e as Error).message); })
      .finally(() => setBusy(false));
  }

  if (!editing) {
    return (
      <DisplayShell isFixtures={isFixtures} onEdit={() => setEditing(true)} className={className}>
        <span className={cn('font-v4-mono text-ink numeric', !shadow && 'italic text-ink/45')}>{shadow || '未設定'}</span>
        {busy && <Loader2 className="absolute right-7 top-2 h-3 w-3 animate-spin text-ink/40" strokeWidth={2} />}
        {err && <div className="text-[11px] text-claret">{err}</div>}
      </DisplayShell>
    );
  }
  return (
    <div className={cn('grid gap-1', className)}>
      <div className="flex items-center gap-2">
        <input
          ref={ref}
          type="date"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch { /* 略過 */ } }}
          onBlur={() => commit(draft)}
          className="rounded-md border border-ink/30 bg-cream/40 px-2.5 py-1 font-v4-mono text-sm text-ink focus:border-ink/50 focus:outline-none"
        />
        <button type="button" onClick={() => commit('')} className="text-xs text-ink/55 hover:text-claret">清除</button>
      </div>
    </div>
  );
}

// ---------------- Inline number (0-10 score) ----------------
export function InlineScore({
  value, onSave, isFixtures,
}: {
  value: number;
  onSave: SaveFn<number>;
  isFixtures: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [shadow, setShadow] = useState(value);
  const [draft, setDraft] = useState(String(value));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setShadow(value); setDraft(String(value)); }, [value]);
  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select(); } }, [editing]);

  function commit() {
    const n = Math.max(0, Math.min(10, Math.round(Number(draft))));
    if (Number.isNaN(n) || n === shadow) { setEditing(false); setDraft(String(shadow)); return; }
    setShadow(n);
    setEditing(false);
    setBusy(true); setErr(null);
    onSave(n)
      .catch((e) => { setShadow(value); setDraft(String(value)); setErr((e as Error).message); })
      .finally(() => setBusy(false));
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => !isFixtures && setEditing(true)}
        disabled={isFixtures}
        className={cn(
          'font-v4-mono text-sm font-semibold text-ink numeric tabular-nums relative',
          !isFixtures && 'rounded-sm px-1.5 py-0.5 transition hover:bg-cream/60 hover:ring-1 hover:ring-ink/20',
          isFixtures && 'cursor-not-allowed',
        )}
        title={err ?? (isFixtures ? 'fixtures 模式無法編輯' : '點擊修改')}
      >
        {shadow}
        {busy && <Loader2 className="ml-1 inline h-2.5 w-2.5 animate-spin text-ink/40" strokeWidth={2} />}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <input
        ref={ref}
        type="number"
        min={0}
        max={10}
        step={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(String(shadow)); setEditing(false); } }}
        className="w-14 rounded-md border border-ink/30 bg-cream/40 px-1.5 py-0.5 font-v4-mono text-sm font-semibold text-ink focus:border-ink/50 focus:outline-none"
      />
    </div>
  );
}

// ---------------- Inline money(金額,USD,可空) ----------------
export function InlineMoney({
  value, onSave, isFixtures, placeholder,
}: {
  value: number | null;
  onSave: SaveFn<number | null>;
  isFixtures: boolean;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [shadow, setShadow] = useState<number | null>(value);
  const [draft, setDraft] = useState(value == null ? '' : String(value));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setShadow(value); setDraft(value == null ? '' : String(value)); }, [value]);
  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select(); } }, [editing]);

  function commit() {
    const t = draft.trim();
    if (t !== '' && Number.isNaN(Number(t))) { setEditing(false); setDraft(shadow == null ? '' : String(shadow)); return; }
    const next = t === '' ? null : Math.max(0, Math.round(Number(t)));
    if (next === shadow) { setEditing(false); return; }
    setShadow(next);
    setEditing(false);
    setBusy(true); setErr(null);
    onSave(next)
      .catch((e) => { setShadow(value); setDraft(value == null ? '' : String(value)); setErr((e as Error).message); })
      .finally(() => setBusy(false));
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => !isFixtures && setEditing(true)}
        disabled={isFixtures}
        className={cn(
          'font-v4-mono text-sm font-semibold numeric tabular-nums relative',
          shadow == null ? 'italic text-ink/45' : 'text-ink',
          !isFixtures && 'rounded-sm px-1.5 py-0.5 transition hover:bg-cream/60 hover:ring-1 hover:ring-ink/20',
          isFixtures && 'cursor-not-allowed',
        )}
        title={err ?? (isFixtures ? 'fixtures 模式無法編輯' : '點擊修改')}
      >
        {shadow == null ? (placeholder ?? '未設定') : fmtMoney(shadow)}
        {busy && <Loader2 className="ml-1 inline h-2.5 w-2.5 animate-spin text-ink/40" strokeWidth={2} />}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <input
        ref={ref}
        type="number"
        min={0}
        step={1000}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(shadow == null ? '' : String(shadow)); setEditing(false); } }}
        className="w-28 rounded-md border border-ink/30 bg-cream/40 px-1.5 py-0.5 font-v4-mono text-sm font-semibold text-ink focus:border-ink/50 focus:outline-none"
      />
    </div>
  );
}

// ============================================================
// 共用 wrapper:展示模式邊框 + pencil 提示
// ============================================================
function DisplayShell({
  children, onEdit, isFixtures, className,
}: {
  children: React.ReactNode;
  onEdit: () => void;
  isFixtures: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => !isFixtures && onEdit()}
      disabled={isFixtures}
      title={isFixtures ? 'fixtures 模式無法編輯' : '點擊修改'}
      className={cn(
        'group relative grid w-full items-start gap-2 rounded-md border border-transparent px-2 py-1 text-left transition',
        !isFixtures && 'hover:border-ink/15 hover:bg-cream/40',
        isFixtures && 'cursor-not-allowed',
        className,
      )}
    >
      <div>{children}</div>
      {!isFixtures && (
        <Pencil className="absolute right-2 top-2 h-3 w-3 text-ink/30 opacity-0 transition group-hover:opacity-100" strokeWidth={2} />
      )}
    </button>
  );
}
