'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/v4/utils';
import type { Profile, Role } from '@/lib/v4/types';

const ROLE_LABEL: Record<Role, string> = {
  admin: '🛡 admin',
  team_lead: '👥 team lead',
  rm: '💼 RM',
};

export function HubTopBar({
  pageLabel,
  source: _source,
  profile,
}: {
  pageLabel?: string;
  source: 'supabase' | 'fixtures';
  profile: Profile | null;
}) {
  void _source;
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const displayName = profile?.full_name?.trim() || profile?.email || '未登入';
  const initial = (profile?.full_name?.trim() || profile?.email || '?').charAt(0).toUpperCase();
  const roleLabel = profile ? ROLE_LABEL[profile.role] : '訪客';

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

  // click outside / ESC 關閉 menu
  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setMenuOpen(false); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 border-b border-ink/10 bg-paper/85 backdrop-blur">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ink/30 to-transparent" />
      <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-6 lg:px-10">
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          {pageLabel ? (
            <Link
              href="/hub"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-ink/12 bg-paper px-2.5 py-1.5 text-xs font-semibold text-ink/70 transition hover:border-ink/30 hover:text-ink sm:px-3"
              aria-label="回 Hub"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
              <span className="hidden sm:inline">回 Hub</span>
            </Link>
          ) : (
            <Link
              href="/"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-ink/12 bg-paper px-2.5 py-1.5 text-xs font-semibold text-ink/70 transition hover:border-ink/30 hover:text-ink sm:px-3"
              aria-label="切換版型"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
              <span className="hidden sm:inline">切換版型</span>
            </Link>
          )}
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-ink text-paper font-v4-serif text-sm font-bold">沃</span>
          <div className="min-w-0 leading-tight">
            <div className="truncate font-v4-serif text-sm font-semibold text-ink">{pageLabel ?? 'Hub'}</div>
            <div className="hidden font-v4-mono text-[10px] text-ink/45 sm:block">WORLDSUN</div>
          </div>
        </div>

        {/* 使用者區塊 + 登出 menu */}
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={cn(
              'flex items-center gap-2 rounded-md border border-ink/12 bg-paper px-2 py-1.5 transition hover:border-ink/30 sm:px-2.5',
              menuOpen && 'border-ink/30 bg-cream/60',
            )}
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-forest font-v4-mono text-[11px] font-bold text-paper">
              {initial}
            </span>
            <div className="hidden min-w-0 max-w-[160px] leading-tight sm:block lg:max-w-[200px]">
              <div className="truncate text-xs font-semibold text-ink">{displayName}</div>
              <div className="truncate font-v4-mono text-[10px] text-ink/55">{roleLabel}</div>
            </div>
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-40 mt-1 grid w-[220px] gap-1 rounded-md border border-ink/12 bg-paper p-1 shadow-panel"
            >
              <div className="grid gap-0.5 px-2.5 py-2 sm:hidden">
                <div className="truncate text-xs font-semibold text-ink">{displayName}</div>
                <div className="font-v4-mono text-[10px] text-ink/55">{roleLabel}</div>
              </div>
              <div className="border-t border-ink/8 sm:hidden" />
              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm font-semibold text-claret transition hover:bg-claret/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {signingOut ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                ) : (
                  <LogOut className="h-4 w-4" strokeWidth={1.75} />
                )}
                {signingOut ? '登出中…' : '登出'}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
