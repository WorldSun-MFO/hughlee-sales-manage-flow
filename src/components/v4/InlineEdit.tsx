'use client';

// ============================================================
// Inline edit 元件群 — ClientDetailView Sprint B 用
// ============================================================
// 設計原則:
//   - 預設「展示模式」看起來像普通文字,hover 時露出邊框暗示可編
//   - 點擊進入「編輯模式」,失焦或 Enter 保存(textarea 用 Cmd/Ctrl+Enter)
//   - Esc 取消
//   - 保存中顯示 spinner,完成後立刻回展示模式
//   - 失敗顯示紅字錯誤,值回到原本
//   - fixtures 模式整個元件 read-only
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Pencil, X } from 'lucide-react';
import { cn } from '@/lib/v4/utils';

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
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  async function commit() {
    const next = draft.trim();
    if (next === value) { setEditing(false); return; }
    setBusy(true); setErr(null);
    try { await onSave(next); setEditing(false); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  if (!editing) {
    return (
      <DisplayShell isFixtures={isFixtures} onEdit={() => setEditing(true)} className={cn('block', className)}>
        <span className={cn('text-ink', !value && 'italic text-ink/45', displayClassName)}>{value || (placeholder ?? '—')}</span>
      </DisplayShell>
    );
  }
  return (
    <div className={cn('grid gap-1', className)}>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
          onBlur={commit}
          disabled={busy}
          className="flex-1 rounded-md border border-ink/30 bg-cream/40 px-2.5 py-1.5 text-sm text-ink focus:border-ink/50 focus:outline-none"
        />
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-ink/55" strokeWidth={2} />}
      </div>
      {err && <div className="text-[11px] text-claret">{err}</div>}
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
  const [draft, setDraft] = useState(value ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(value ?? ''); }, [value]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  async function commit() {
    const next = draft.trim();
    if ((next || null) === (value ?? null)) { setEditing(false); return; }
    setBusy(true); setErr(null);
    try { await onSave(next || null); setEditing(false); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }
  function cancel() { setDraft(value ?? ''); setEditing(false); setErr(null); }

  if (!editing) {
    return (
      <DisplayShell isFixtures={isFixtures} onEdit={() => setEditing(true)} className={className}>
        <div className={cn('whitespace-pre-wrap text-ink', !value && 'italic text-ink/45', displayClassName)}>
          {value || (placeholder ?? '—')}
        </div>
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
        disabled={busy}
        className="w-full resize-vertical rounded-md border border-ink/30 bg-cream/40 px-3 py-2 text-sm leading-6 text-ink focus:border-ink/50 focus:outline-none"
      />
      <div className="flex items-center justify-end gap-2">
        {err && <span className="mr-auto text-[11px] text-claret">{err}</span>}
        <button type="button" onClick={cancel} disabled={busy} className="inline-flex items-center gap-1 rounded-md border border-ink/15 bg-paper px-2.5 py-1 text-xs text-ink/65 hover:border-ink/30">
          <X className="h-3 w-3" strokeWidth={2} /> 取消
        </button>
        <button type="button" onClick={commit} disabled={busy} className="inline-flex items-center gap-1 rounded-md bg-ink px-2.5 py-1 text-xs font-semibold text-paper hover:bg-graphite disabled:bg-ink/30">
          {busy ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} /> : <Check className="h-3 w-3" strokeWidth={2} />} 儲存
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
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const selfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!selfRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  async function pick(next: T | null) {
    setOpen(false);
    if (next === value) return;
    setBusy(true); setErr(null);
    try { await onSave(next); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div ref={selfRef} className={cn('relative inline-flex flex-col gap-1', className)}>
      <button
        type="button"
        onClick={() => !isFixtures && !busy && setOpen((v) => !v)}
        disabled={isFixtures || busy}
        className={cn(
          'group inline-flex items-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm transition hover:border-ink/15 hover:bg-cream/40',
          isFixtures && 'cursor-not-allowed opacity-70',
        )}
      >
        {renderDisplay ? renderDisplay(value) : <span className="font-v4-mono font-semibold text-ink">{options.find((o) => o.value === value)?.label ?? '—'}</span>}
        {busy ? <Loader2 className="h-3 w-3 animate-spin text-ink/55" strokeWidth={2} /> : !isFixtures && <Pencil className="h-3 w-3 text-ink/30 opacity-0 transition group-hover:opacity-100" strokeWidth={2} />}
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
                  o.value === value ? 'bg-ink text-paper' : 'text-ink hover:bg-cream/60',
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
  const [draft, setDraft] = useState(value ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { setDraft(value ?? ''); }, [value]);

  async function commit(next: string) {
    if ((next || null) === (value ?? null)) { setEditing(false); return; }
    setBusy(true); setErr(null);
    try { await onSave(next || null); setEditing(false); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  if (!editing) {
    return (
      <DisplayShell isFixtures={isFixtures} onEdit={() => setEditing(true)} className={className}>
        <span className={cn('font-v4-mono text-ink numeric', !value && 'italic text-ink/45')}>{value || '未設定'}</span>
      </DisplayShell>
    );
  }
  return (
    <div className={cn('grid gap-1', className)}>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft)}
          autoFocus
          disabled={busy}
          className="rounded-md border border-ink/30 bg-cream/40 px-2.5 py-1 font-v4-mono text-sm text-ink focus:border-ink/50 focus:outline-none"
        />
        <button type="button" onClick={() => commit('')} disabled={busy} className="text-xs text-ink/55 hover:text-claret">清除</button>
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-ink/55" strokeWidth={2} />}
      </div>
      {err && <div className="text-[11px] text-claret">{err}</div>}
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
  const [draft, setDraft] = useState(String(value));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(String(value)); }, [value]);
  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select(); } }, [editing]);

  async function commit() {
    const n = Math.max(0, Math.min(10, Math.round(Number(draft))));
    if (Number.isNaN(n) || n === value) { setEditing(false); setDraft(String(value)); return; }
    setBusy(true); setErr(null);
    try { await onSave(n); setEditing(false); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => !isFixtures && setEditing(true)}
        disabled={isFixtures}
        className={cn(
          'font-v4-mono text-sm font-semibold text-ink numeric tabular-nums',
          !isFixtures && 'rounded-sm px-1.5 py-0.5 transition hover:bg-cream/60 hover:ring-1 hover:ring-ink/20',
          isFixtures && 'cursor-not-allowed',
        )}
        title={isFixtures ? 'fixtures 模式無法編輯' : '點擊修改'}
      >
        {value}
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
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(String(value)); setEditing(false); } }}
        disabled={busy}
        className="w-14 rounded-md border border-ink/30 bg-cream/40 px-1.5 py-0.5 font-v4-mono text-sm font-semibold text-ink focus:border-ink/50 focus:outline-none"
      />
      {busy && <Loader2 className="h-3 w-3 animate-spin text-ink/55" strokeWidth={2} />}
      {err && <span className="text-[10px] text-claret">{err}</span>}
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
