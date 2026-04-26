import Link from 'next/link';
import { Home, Inbox, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface Props {
  title: string;
  children: ReactNode;
  /** 哪個 tab 高亮 */
  active?: 'home' | 'inbox' | 'search';
  /** 右上角自訂按鈕(例如「新增」) */
  rightSlot?: ReactNode;
  /** 左上角自訂按鈕(例如「返回」) */
  leftSlot?: ReactNode;
}

export function MobileShell({ title, children, active, rightSlot, leftSlot }: Props) {
  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col">
      {/* 頂部標題列 */}
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-zinc-950/80 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
        <div className="px-4 h-14 flex items-center justify-between gap-2 max-w-2xl mx-auto">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {leftSlot}
            <h1 className="text-lg font-semibold truncate">{title}</h1>
          </div>
          {rightSlot}
        </div>
      </header>

      {/* 內容區(底部留空間給 tab bar) */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 pt-4 pb-28">{children}</main>

      {/* 底部 tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 dark:bg-zinc-950/95 backdrop-blur border-t border-zinc-200 dark:border-zinc-800 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-2xl mx-auto grid grid-cols-3 h-16">
          <TabLink href="/mindmap" icon={<Home className="h-5 w-5" />} label="樹狀" active={active === 'home'} />
          <TabLink href="/mindmap/inbox" icon={<Inbox className="h-5 w-5" />} label="收件匣" active={active === 'inbox'} />
          <TabLink href="/mindmap/search" icon={<Search className="h-5 w-5" />} label="搜尋" active={active === 'search'} />
        </div>
      </nav>
    </div>
  );
}

function TabLink({ href, icon, label, active }: { href: string; icon: ReactNode; label: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        'flex flex-col items-center justify-center gap-1 transition-colors',
        active ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-500'
      )}
    >
      {icon}
      <span className="text-xs">{label}</span>
    </Link>
  );
}
