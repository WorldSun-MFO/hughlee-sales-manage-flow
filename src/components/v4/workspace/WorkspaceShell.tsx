'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Briefcase, Database, Gauge, Home, LayoutGrid, MessageSquareText, Route, Settings, Users } from 'lucide-react';
import { cn } from '@/lib/v4/utils';

const nav: Array<{ href: string; label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; group?: string }> = [
  { href: '/v4/workspace', label: '總覽', icon: Gauge, group: 'main' },
  { href: '/v4/workspace/today', label: '今日', icon: Home, group: 'main' },
  { href: '/v4/workspace/pipeline', label: 'Pipeline', icon: LayoutGrid, group: 'main' },
  { href: '/v4/workspace/clients', label: '客戶', icon: Users, group: 'main' },
  { href: '/v4/workspace/ai', label: 'AI 助手', icon: MessageSquareText, group: 'ai' },
  { href: '/v4/workspace/plan', label: '成交規劃', icon: Route, group: 'ai' },
  { href: '/v4/workspace/market', label: '市場大腦', icon: Briefcase, group: 'other' },
  { href: '/v4/workspace/settings', label: '設定', icon: Settings, group: 'other' },
];

export function WorkspaceShell({ children, source }: { children: React.ReactNode; source: 'supabase' | 'fixtures' }) {
  const pathname = usePathname();

  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr] bg-cream">
      <aside className="sticky top-0 flex h-screen flex-col gap-6 border-r border-ink/10 bg-paper px-4 py-5">
        <div>
          <Link href="/v4" className="mb-4 inline-flex items-center gap-1.5 font-v4-mono text-[11px] font-semibold text-ink/55 hover:text-ink">
            <ArrowLeft className="h-3 w-3" strokeWidth={2} /> 切換版型
          </Link>
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-ink text-paper font-v4-serif text-sm font-bold">沃</span>
            <div className="leading-tight">
              <div className="font-v4-serif text-base font-semibold text-ink">Workspace</div>
              <div className="font-v4-mono text-[10px] text-ink/45">WORLDSUN · V4</div>
            </div>
          </div>
        </div>

        <nav className="grid flex-1 content-start gap-1">
          <div className="label-caps mb-1 px-2 text-ink/45">主要</div>
          {nav.filter((n) => n.group === 'main').map((n) => (
            <NavItem key={n.href} item={n} active={isActive(pathname, n.href)} />
          ))}

          <div className="label-caps mb-1 mt-3 px-2 text-ink/45">AI 工具</div>
          {nav.filter((n) => n.group === 'ai').map((n) => (
            <NavItem key={n.href} item={n} active={isActive(pathname, n.href)} />
          ))}

          <div className="label-caps mb-1 mt-3 px-2 text-ink/45">其他</div>
          {nav.filter((n) => n.group === 'other').map((n) => (
            <NavItem key={n.href} item={n} active={isActive(pathname, n.href)} />
          ))}
        </nav>

        <div className="grid gap-2 rounded-md border border-ink/10 bg-cream/60 p-3 text-[11px]">
          <div className="flex items-center gap-1.5">
            <Database className="h-3 w-3 text-ink/55" strokeWidth={2} />
            <span className="label-caps text-ink/55">Data</span>
          </div>
          <div className="font-v4-mono text-ink/75">
            {source === 'supabase' ? '已接 Supabase' : '走 fixtures'}
          </div>
        </div>

        <div className="grid items-center gap-1.5 border-t border-ink/8 pt-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-forest font-v4-mono text-[11px] font-bold text-paper">H</span>
            <div className="leading-tight">
              <div className="text-xs font-semibold text-ink">Hugh Lee</div>
              <div className="font-v4-mono text-[10px] text-ink/55">🛡 admin</div>
            </div>
          </div>
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
        'group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-semibold transition',
        active ? 'bg-ink text-paper' : 'text-ink/70 hover:bg-ink/5 hover:text-ink',
      )}
    >
      <item.icon className="h-4 w-4" strokeWidth={1.75} />
      {item.label}
    </Link>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/v4/workspace') return pathname === '/v4/workspace';
  return pathname === href || pathname.startsWith(href + '/');
}

