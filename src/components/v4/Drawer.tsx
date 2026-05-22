'use client';

// ============================================================
// V4 通用 Drawer — 從右側滑入,Linear / Notion 風
// ============================================================
// 用法:
//   <Drawer open={openKind !== null} onClose={() => setOpenKind(null)} title="AI 助手">
//     {content}
//   </Drawer>
//
// 特性:
//   - 右側滑入,寬度 lg:60% / sm:90% / mobile 全寬
//   - 點背景或按 Esc 關閉
//   - body scroll 鎖定(避免背後跟著捲)
//   - 入場過渡:300ms ease
// ============================================================
import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/v4/utils';

export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden
        className={cn(
          'fixed inset-0 z-40 bg-ink/35 backdrop-blur-[2px] transition-opacity duration-300',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />
      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        className={cn(
          'fixed right-0 top-0 z-50 grid h-full w-full grid-rows-[auto_1fr] border-l border-ink/15 bg-paper shadow-panel transition-transform duration-300 ease-out',
          'sm:w-[90vw] lg:w-[60vw] xl:max-w-[820px]',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <header className="flex items-center justify-between gap-3 border-b border-ink/10 bg-paper/95 px-6 py-4 backdrop-blur">
          <div className="font-v4-serif text-xl font-medium text-ink">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-md border border-ink/12 bg-cream/50 text-ink/65 transition hover:border-ink/30 hover:text-ink"
            aria-label="關閉"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </header>
        <div className="overflow-y-auto px-6 py-6">
          {children}
        </div>
      </aside>
    </>
  );
}
