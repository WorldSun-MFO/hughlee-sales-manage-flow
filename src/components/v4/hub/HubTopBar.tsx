import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export function HubTopBar({ pageLabel, source }: { pageLabel?: string; source: 'supabase' | 'fixtures' }) {
  return (
    <header className="sticky top-0 z-30 border-b border-ink/10 bg-paper/85 backdrop-blur">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ink/30 to-transparent" />
      <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-3 px-6 py-3 lg:px-10">
        <div className="flex items-center gap-2.5">
          {pageLabel ? (
            <Link href="/v4/hub" className="inline-flex items-center gap-1.5 rounded-md border border-ink/12 bg-paper px-3 py-1.5 text-xs font-semibold text-ink/70 transition hover:border-ink/30 hover:text-ink">
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} /> 回 Hub
            </Link>
          ) : (
            <Link href="/v4" className="inline-flex items-center gap-1.5 rounded-md border border-ink/12 bg-paper px-3 py-1.5 text-xs font-semibold text-ink/70 transition hover:border-ink/30 hover:text-ink">
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} /> 切換版型
            </Link>
          )}
          <span className="grid h-8 w-8 place-items-center rounded-md bg-ink text-paper font-v4-serif text-sm font-bold">沃</span>
          <div className="leading-tight">
            <div className="font-v4-serif text-sm font-semibold text-ink">{pageLabel ?? 'Hub'}</div>
            <div className="font-v4-mono text-[10px] text-ink/45">WORLDSUN · V4</div>
          </div>
        </div>
        <div className="flex items-center gap-3 font-v4-mono text-[11px] text-ink/55">
          <span>Hugh Lee</span>
          <span className="text-ink/25">·</span>
          <span className="numeric">{source}</span>
        </div>
      </div>
    </header>
  );
}
