'use client';

// ============================================================
// ClientDetail Shell — 包住所有 stream 進來的 sections
// ============================================================
// 拆 streaming 後,Shell 是唯一 client component(需要 state):
//   - 持有 drawer 開關狀態(ai / plan)
//   - 底部 sticky action bar(剛聯繫 / AI 助手 / 推進階段)
//   - 「回 X」連結
//   - <Drawer> 容器,DealAIPanel / DealPlanPanel 在這裡 render
//
// children = 各 Suspense-wrapped 的 async server section
// ============================================================
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Phone, Sparkles, TrendingUp } from 'lucide-react';
import type { Deal } from '@/lib/v4/types';
import { cn } from '@/lib/v4/utils';
import { Drawer } from '@/components/v4/Drawer';
import { DealAIPanel } from '@/components/v4/DealAIPanel';
import { DealPlanPanel } from '@/components/v4/DealPlanPanel';
import { markContacted } from '@/lib/v4/mutations';
import { RealtimeRefresher } from '@/components/v4/RealtimeRefresher';

type DrawerKind = 'ai' | 'plan' | null;

export function ClientDetailShell({
  deal, backHref, isFixtures, children,
}: {
  deal: Deal;
  backHref: string;
  isFixtures: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [drawer, setDrawer] = useState<DrawerKind>(null);
  const [contactBusy, setContactBusy] = useState(false);
  const [contactMsg, setContactMsg] = useState<string | null>(null);

  async function handleMarkContacted() {
    if (contactBusy) return;
    if (isFixtures) { setContactMsg('fixtures 模式無法寫入'); setTimeout(() => setContactMsg(null), 2500); return; }
    setContactBusy(true); setContactMsg(null);
    try {
      await markContacted(deal.id);
      setContactMsg('✓ 已更新最後聯繫時間(背景同步,不刷新頁面)');
      setTimeout(() => setContactMsg(null), 2500);
    } catch (err) {
      setContactMsg(`失敗:${(err as Error).message}`);
    } finally {
      setContactBusy(false);
    }
  }

  const backLabel = backHref.includes('pipeline') ? '回 Pipeline'
    : backHref.includes('today') ? '回今日' : '回客戶名冊';
  // workspace 版型左側有 264px sidebar,固定底欄要避開;hub 版型(top bar)整寬
  const isWorkspace = backHref.startsWith('/workspace');

  return (
    // pb-28 預留固定底欄高度,避免最後一個 section 被蓋住
    <div className="grid gap-10 px-8 pt-10 pb-28 lg:px-14 lg:pt-14">
      <RealtimeRefresher isFixtures={isFixtures} />

      <div>
        <Link href={backHref as never} className="inline-flex items-center gap-1.5 font-v4-mono text-xs font-semibold text-ink/55 transition hover:text-ink">
          <ArrowLeft className="h-3 w-3" strokeWidth={2} /> {backLabel}
        </Link>
      </div>

      {children}

      {/* 固定底欄 — 釘在可視畫面最底、跟著滾動;workspace 版型避開左側 sidebar */}
      <section className={cn(
        'fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 gap-2 border-t border-ink/10 bg-cream/95 px-8 py-4 backdrop-blur lg:px-14',
        isWorkspace && 'lg:left-[264px]',
      )}>
        <Action icon={contactBusy ? Loader2 : Phone} iconClass={contactBusy ? 'animate-spin' : undefined} tone="paper" onClick={handleMarkContacted} disabled={contactBusy}>
          {contactBusy ? '更新中…' : '剛聯繫'}
        </Action>
        <Action icon={Sparkles} tone="cobalt" onClick={() => setDrawer('ai')}>AI 助手</Action>
        <Action icon={TrendingUp} tone="forest" onClick={() => setDrawer('plan')}>推進階段</Action>
        {contactMsg && (
          <div className="col-span-3 -mt-1 text-center font-v4-mono text-[11px] text-ink/65">{contactMsg}</div>
        )}
      </section>

      <Drawer
        open={drawer !== null}
        onClose={() => setDrawer(null)}
        title={
          <span className="inline-flex items-center gap-2">
            {drawer === 'ai' ? <Sparkles className="h-4 w-4 text-cobalt" strokeWidth={1.75} /> : <TrendingUp className="h-4 w-4 text-forest" strokeWidth={1.75} />}
            {drawer === 'ai' ? 'AI 助手' : '推進階段 · 成交規劃'}
          </span>
        }
      >
        {drawer === 'ai' && <DealAIPanel deal={deal} isFixtures={isFixtures} />}
        {drawer === 'plan' && <DealPlanPanel deal={deal} isFixtures={isFixtures} />}
      </Drawer>
    </div>
  );
}

function Action({
  icon: Icon, iconClass, tone, children, onClick, disabled, title,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  iconClass?: string;
  tone: 'paper' | 'forest' | 'cobalt';
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  const cls = tone === 'forest' ? 'bg-forest text-paper border-forest hover:brightness-110'
    : tone === 'cobalt' ? 'bg-cobalt text-paper border-cobalt hover:brightness-110'
      : 'border-ink/15 bg-paper text-ink hover:border-ink/30';
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      className={cn(
        'inline-flex h-11 items-center justify-center gap-2 rounded-md border text-sm font-semibold transition',
        cls,
        disabled && 'opacity-60 cursor-not-allowed hover:brightness-100',
      )}
    >
      <Icon className={cn('h-4 w-4', iconClass)} strokeWidth={1.75} />
      {children}
    </button>
  );
}
