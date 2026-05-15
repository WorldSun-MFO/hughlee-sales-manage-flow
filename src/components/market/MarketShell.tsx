import Link from 'next/link';
import type { ReactNode } from 'react';

/** 市場大腦共用版面:沿用 pipeline 的 slate header,左上可返回 pipeline。 */
export function MarketShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">🧠</div>
            <div>
              <div className="font-semibold text-sm leading-tight">{title}</div>
              <div className="text-[10px] text-slate-400 leading-tight">WORLDSUN 金融資訊大腦</div>
              {subtitle && <div className="text-xs text-slate-500 leading-tight">{subtitle}</div>}
            </div>
          </div>
          <div className="flex-1" />
          {actions}
          <Link
            href="/"
            className="inline-flex items-center justify-center h-9 px-3 border border-slate-200 rounded-lg text-sm hover:bg-slate-50"
            title="回 Pipeline"
          >
            ← Pipeline
          </Link>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-4 space-y-4 pb-24">{children}</main>
    </>
  );
}
