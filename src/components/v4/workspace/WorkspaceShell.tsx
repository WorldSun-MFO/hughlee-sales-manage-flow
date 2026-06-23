'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowLeft, Briefcase, CalendarCheck, ClipboardList, Gauge, Home, LayoutGrid, LogOut, Menu, MessageSquareText,
  Route, Settings, Users, X,
} from 'lucide-react';
import { cn } from '@/lib/v4/utils';
import { createClient } from '@/lib/supabase/client';
import type { Profile, Role } from '@/lib/v4/types';

const ROLE_LABEL: Record<Role, string> = {
  admin: '🛡 admin',
  team_lead: '👥 team lead',
  rm: '💼 RM',
};

const nav: Array<{ href: string; label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; group?: string; adminOnly?: boolean }> = [
  { href: '/workspace', label: '總覽', icon: Gauge, group: 'main' },
  { href: '/workspace/today', label: '今日', icon: Home, group: 'main' },
  { href: '/workspace/tasks', label: '我的任務', icon: ClipboardList, group: 'main' },
  { href: '/workspace/pipeline', label: 'Pipeline', icon: LayoutGrid, group: 'main' },
  { href: '/workspace/clients', label: '客戶', icon: Users, group: 'main' },
  { href: '/workspace/ai', label: 'AI 助手', icon: MessageSquareText, group: 'ai' },
  { href: '/workspace/plan', label: '成交規劃', icon: Route, group: 'ai' },
  { href: '/workspace/close-dates', label: '成交日確認', icon: CalendarCheck, group: 'other', adminOnly: true },
  { href: '/workspace/market', label: '市場大腦', icon: Briefcase, group: 'other' },
  { href: '/workspace/settings', label: '設定', icon: Settings, group: 'other' },
];

export function WorkspaceShell({
  children, source: _source, profile,
}: {
  children: React.ReactNode;
  source: 'supabase' | 'fixtures';
  profile: Profile | null;
}) {
  void _source;
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/login');
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  }

  // 換頁自動關閉 sidebar + user menu
  useEffect(() => { setOpen(false); setUserMenuOpen(false); }, [pathname]);

  // user menu — click outside / ESC 關閉
  useEffect(() => {
    if (!userMenuOpen) return;
    function onDown(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setUserMenuOpen(false); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [userMenuOpen]);

  // ESC 關閉 + 開啟時鎖背景滾動
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const displayName = profile?.full_name?.trim() || profile?.email || '未登入';
  const initial = (profile?.full_name?.trim() || profile?.email || '?').charAt(0).toUpperCase();
  const roleLabel = profile ? ROLE_LABEL[profile.role] : '訪客';

  // adminOnly 項目(如「成交日確認」)只給管理員看;頁面本身另有後端把關
  const isAdmin = profile?.role === 'admin';
  const visibleNav = nav.filter((n) => !n.adminOnly || isAdmin);

  return (
    <div className="min-h-screen bg-cream lg:grid lg:grid-cols-[264px_1fr]">
      {/* 行動裝置頂欄(漢堡 + 標題) */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-ink/10 bg-paper/90 px-4 py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="grid h-9 w-9 place-items-center rounded-md border border-ink/12 text-ink/70 hover:border-ink/30 hover:text-ink"
          aria-label="開啟選單"
        >
          <Menu className="h-5 w-5" strokeWidth={1.75} />
        </button>
        <span className="grid h-8 w-8 place-items-center rounded-md bg-ink text-paper font-v4-serif text-sm font-bold">沃</span>
        <div className="min-w-0 leading-tight">
          <div className="truncate font-v4-serif text-sm font-semibold text-ink">Workspace</div>
          <div className="font-v4-mono text-[10px] text-ink/45">WORLDSUN · V4</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-forest font-v4-mono text-[11px] font-bold text-paper">
            {initial}
          </span>
        </div>
      </header>

      {/* 背景遮罩(mobile 開啟時)*/}
      {open && (
        <button
          type="button"
          aria-label="關閉選單"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-ink/45 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* 側邊欄 — mobile drawer / desktop persistent */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col gap-6 border-r border-ink/10 bg-paper px-4 py-5 transition-transform duration-200 ease-out',
          'lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-auto lg:max-w-none lg:translate-x-0',
          open ? 'translate-x-0 shadow-panel' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="grid gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 font-v4-mono text-[11px] font-semibold text-ink/55 hover:text-ink"
            >
              <ArrowLeft className="h-3 w-3" strokeWidth={2} /> 切換版型
            </Link>
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-ink text-paper font-v4-serif text-sm font-bold">沃</span>
              <div className="min-w-0 leading-tight">
                <div className="truncate font-v4-serif text-base font-semibold text-ink">Workspace</div>
                <div className="truncate font-v4-mono text-[10px] text-ink/45">WORLDSUN · V4</div>
              </div>
            </div>
          </div>
          {/* mobile 關閉按鈕 */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid h-8 w-8 place-items-center rounded-md text-ink/55 hover:bg-ink/5 hover:text-ink lg:hidden"
            aria-label="關閉選單"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        <nav className="grid flex-1 content-start gap-1 overflow-y-auto">
          <div className="label-caps mb-1 px-2 text-ink/45">主要</div>
          {visibleNav.filter((n) => n.group === 'main').map((n) => (
            <NavItem key={n.href} item={n} active={isActive(pathname, n.href)} />
          ))}

          <div className="label-caps mb-1 mt-3 px-2 text-ink/45">AI 工具</div>
          {visibleNav.filter((n) => n.group === 'ai').map((n) => (
            <NavItem key={n.href} item={n} active={isActive(pathname, n.href)} />
          ))}

          <div className="label-caps mb-1 mt-3 px-2 text-ink/45">其他</div>
          {visibleNav.filter((n) => n.group === 'other').map((n) => (
            <NavItem key={n.href} item={n} active={isActive(pathname, n.href)} />
          ))}
        </nav>

        <div ref={userMenuRef} className="relative grid items-center gap-1.5 border-t border-ink/8 pt-3">
          <button
            type="button"
            onClick={() => setUserMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={userMenuOpen}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition',
              userMenuOpen ? 'bg-ink/5' : 'hover:bg-ink/5',
            )}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-forest font-v4-mono text-[11px] font-bold text-paper">
              {initial}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-xs font-semibold text-ink">{displayName}</div>
              <div className="truncate font-v4-mono text-[10px] text-ink/55">{roleLabel}</div>
            </div>
          </button>
          {userMenuOpen && (
            <div
              role="menu"
              className="absolute bottom-full left-0 right-0 mb-1 grid gap-0.5 rounded-md border border-ink/12 bg-paper p-1 shadow-panel"
            >
              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm font-semibold text-claret transition hover:bg-claret/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.75} />
                {signingOut ? '登出中…' : '登出'}
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="min-h-screen overflow-x-hidden">{children}</main>
    </div>
  );
}

function NavItem({ item, active }: { item: { href: string; label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        'group flex items-center gap-2.5 whitespace-nowrap rounded-md px-2.5 py-2 text-sm font-semibold transition',
        active ? 'bg-ink text-paper' : 'text-ink/70 hover:bg-ink/5 hover:text-ink',
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/workspace') return pathname === '/workspace';
  return pathname === href || pathname.startsWith(href + '/');
}
