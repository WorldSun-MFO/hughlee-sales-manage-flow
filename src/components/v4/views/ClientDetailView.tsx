'use client';

// ============================================================
// 客戶詳情頁 — v4
// ============================================================
// 變動(Phase 2.3):
//   - 從 server component → client component(因為要 state 控 Drawer)
//   - 底部三顆按鈕從裝飾變功能:
//     · 剛聯繫:Phase 2.4 再做(會打 last_contact_at)
//     · AI 助手:右側 slide-in Drawer 跑 /api/ai/parse-interaction
//     · 推進階段:右側 slide-in Drawer 跑 /api/ai/generate-plan
//   - Drawer 內共用 DealAIPanel / DealPlanPanel(不重抓 deal list,
//     因為 deal 已知)
// ============================================================
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Calendar, Phone, Sparkles, TrendingUp } from 'lucide-react';
import type { Scores, Snapshot } from '@/lib/v4/types';
import { STAGE_PROB } from '@/lib/v4/constants';
import { cn, contactOverdue, daysSince, fmtMoney, redFlag, totalScore, TIER_STYLES } from '@/lib/v4/utils';
import { Drawer } from '@/components/v4/Drawer';
import { DealAIPanel } from '@/components/v4/DealAIPanel';
import { DealPlanPanel } from '@/components/v4/DealPlanPanel';

const MEDDIC_LABELS: Array<[keyof Scores, string, string]> = [
  ['m', 'M', 'Metrics'],
  ['e', 'E', 'Economic Buyer'],
  ['d1', 'D₁', 'Decision Criteria'],
  ['d2', 'D₂', 'Decision Process'],
  ['p', 'P', 'Paper Process'],
  ['i', 'I', 'Identify Pain'],
  ['c1', 'C₁', 'Champion'],
  ['c2', 'C₂', 'Competition'],
];

type DrawerKind = 'ai' | 'plan' | null;

export function ClientDetailView({
  snapshot, dealId, base, backHref,
}: {
  snapshot: Snapshot;
  dealId: string;
  base: '/v4/workspace' | '/v4/hub';
  backHref: string;
}) {
  void base;
  const [drawer, setDrawer] = useState<DrawerKind>(null);
  const deal = snapshot.deals.find((d) => d.id === dealId);
  if (!deal) {
    return (
      <div className="grid place-items-center px-8 py-20">
        <div className="grid gap-3 text-center">
          <div className="font-v4-serif text-3xl text-ink">找不到此客戶</div>
          <Link href={backHref} className="inline-flex items-center gap-1.5 font-v4-mono text-xs font-semibold text-ink/55 hover:text-ink">
            <ArrowLeft className="h-3 w-3" /> 返回
          </Link>
        </div>
      </div>
    );
  }

  const tasks = snapshot.tasks.filter((t) => t.deal_id === deal.id);
  const score = totalScore(deal);
  const rf = redFlag(deal);
  const ci = contactOverdue(deal, snapshot.tierConfig);
  const isFixtures = snapshot.source === 'fixtures';

  return (
    <div className="grid gap-10 px-8 py-10 lg:px-14 lg:py-14">
      <div>
        <Link href={backHref} className="inline-flex items-center gap-1.5 font-v4-mono text-xs font-semibold text-ink/55 transition hover:text-ink">
          <ArrowLeft className="h-3 w-3" strokeWidth={2} /> {backHref.includes('pipeline') ? '回 Pipeline' : backHref.includes('today') ? '回今日' : '回客戶名冊'}
        </Link>
      </div>

      <header className="grid gap-3">
        <div className="flex items-center gap-2">
          {deal.tier ? (
            <span className={`rounded-sm px-2 py-1 font-v4-mono text-[11px] font-bold ${TIER_STYLES[deal.tier]}`}>{deal.tier}</span>
          ) : null}
          <span className={`stage-${deal.stage} rounded-sm px-2 py-1 font-v4-mono text-[11px] font-bold`}>
            {deal.stage} · {STAGE_PROB[deal.stage]}%
          </span>
          <span className="font-v4-mono text-[11px] text-ink/45 numeric">DEAL · {deal.id.toUpperCase()}</span>
        </div>
        <h1 className="font-v4-serif text-[44px] font-medium leading-[1.05] tracking-tight text-ink lg:text-[56px]">
          {deal.name.replace(/^【範例】/, '')}
        </h1>
        <div className="font-v4-mono text-sm text-ink/55">{deal.product ?? '—'} · {deal.rm?.full_name ?? '—'}</div>
      </header>

      {(rf || ci?.status === 'overdue') ? (
        <div className="grid gap-2">
          {rf ? (
            <div className="flex items-center gap-2 rounded-md border border-claret/30 bg-claret/8 px-4 py-3 text-sm font-semibold text-claret">
              <span className="text-base">🚩</span> {rf}
            </div>
          ) : null}
          {ci?.status === 'overdue' ? (
            <div className="flex items-center gap-2 rounded-md border border-brass/40 bg-brass/10 px-4 py-3 text-sm font-semibold text-brass">
              <Phone className="h-4 w-4" strokeWidth={1.75} /> 已逾期 {ci.deltaDays} 天未聯繫
            </div>
          ) : null}
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="AUM" value={fmtMoney(Number(deal.aum_usd))} />
        <Stat label="MEDDIC" value={`${score} / 80`} />
        <Stat label="最後更新" value={`${daysSince(deal.last_updated)} 天前`} />
        <Stat label="最後聯繫" value={deal.last_contact_at ? `${daysSince(deal.last_contact_at)} 天前` : '—'} />
      </section>

      <section className="grid gap-3">
        <div className="label-caps text-ink/55">下一步</div>
        <div className="rounded-md border border-ink/10 bg-cream/60 p-6 font-v4-serif text-lg leading-relaxed text-ink whitespace-pre-wrap">
          {deal.next_step ?? '尚未填寫下一步。'}
        </div>
        {deal.target_close_date ? (
          <div className="flex items-center gap-1.5 font-v4-mono text-xs text-ink/55">
            <Calendar className="h-3 w-3" strokeWidth={2} />
            目標成交 <span className="font-semibold text-ink numeric">{deal.target_close_date}</span>
          </div>
        ) : null}
      </section>

      <section className="grid gap-3">
        <div className="label-caps text-ink/55">MEDDIC 評分</div>
        <div className="grid gap-2 rounded-md border border-ink/10 bg-paper p-5 sm:grid-cols-2">
          {MEDDIC_LABELS.map(([k, key, label]) => {
            const v = deal.scores?.[k] ?? 0;
            const tone = v >= 8 ? 'bg-forest' : v >= 5 ? 'bg-brass' : v >= 3 ? 'bg-ink/40' : 'bg-claret/70';
            return (
              <div key={k} className="grid grid-cols-[40px_1fr_80px] items-center gap-3 rounded-sm border border-ink/8 px-3 py-2">
                <span className="font-v4-mono text-sm font-bold text-ink">{key}</span>
                <span className="text-xs text-ink/65">{label}</span>
                <div className="flex items-center justify-end gap-2">
                  <div className="h-1.5 w-14 overflow-hidden rounded-full bg-ink/8">
                    <div className={cn('h-full', tone)} style={{ width: `${v * 10}%` }} />
                  </div>
                  <span className="font-v4-mono text-sm font-semibold text-ink numeric">{v}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {(deal.comments?.length ?? 0) > 0 ? (
        <section className="grid gap-3">
          <div className="label-caps text-ink/55">活動紀錄</div>
          <div className="grid gap-2">
            {deal.comments!.map((c) => {
              const author = snapshot.profiles.find((p) => p.id === c.author_id);
              return (
                <div
                  key={c.id}
                  className={cn(
                    'rounded-md border px-4 py-3',
                    c.is_system ? 'border-ink/10 bg-ink/2 text-ink/65'
                      : c.is_raw ? 'border-cobalt/25 bg-cobalt/4'
                        : 'border-ink/10 bg-cream/40',
                  )}
                >
                  <div className="flex items-center justify-between gap-2 font-v4-mono text-[11px] text-ink/45">
                    <span>{author?.full_name ?? (c.is_system ? 'system' : 'ai')}</span>
                    <span className="numeric">{daysSince(c.created_at)} 天前</span>
                  </div>
                  <div className="mt-1 text-sm leading-6 text-ink/85">{c.body}</div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {tasks.length > 0 ? (
        <section className="grid gap-3">
          <div className="label-caps text-ink/55">任務 · {tasks.length}</div>
          <ul className="grid gap-2">
            {tasks.map((t) => (
              <li key={t.id} className="grid grid-cols-[1fr_80px_120px] items-center gap-3 rounded-md border border-ink/10 bg-paper px-4 py-3 text-sm">
                <div>
                  <div className="font-semibold text-ink">{t.title}</div>
                  <div className="font-v4-mono text-[11px] text-ink/45 numeric">due {t.due_date ?? '—'}</div>
                </div>
                <span className={cn('rounded-sm border px-1.5 py-0.5 text-center font-v4-mono text-[10px] font-bold',
                  t.priority === 'high' ? 'border-claret/30 bg-claret/8 text-claret' : 'border-ink/15 text-ink/65')}>
                  {t.priority}
                </span>
                <span className={cn('rounded-sm border px-1.5 py-0.5 text-center font-v4-mono text-[10px] font-bold',
                  t.status === 'done' ? 'border-forest/30 bg-forest/8 text-forest'
                    : t.status === 'doing' ? 'border-cobalt/30 bg-cobalt/8 text-cobalt'
                      : 'border-ink/15 text-ink/65')}>
                  {t.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* 底部固定 action bar */}
      <section className="sticky bottom-0 -mx-8 grid grid-cols-3 gap-2 border-t border-ink/10 bg-cream/95 px-8 py-4 backdrop-blur lg:-mx-14 lg:px-14">
        <Action icon={Phone} tone="paper" disabled title="Phase 2.4 會做">剛聯繫</Action>
        <Action icon={Sparkles} tone="cobalt" onClick={() => setDrawer('ai')}>AI 助手</Action>
        <Action icon={TrendingUp} tone="forest" onClick={() => setDrawer('plan')}>推進階段</Action>
      </section>

      {/* Drawer 容器 — 只有一個,內容依 drawer kind 切換 */}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-ink/10 bg-paper px-4 py-3">
      <div className="label-caps text-ink/45">{label}</div>
      <div className="mt-1 font-v4-mono text-lg font-semibold text-ink numeric">{value}</div>
    </div>
  );
}

function Action({
  icon: Icon, tone, children, onClick, disabled, title,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
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
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'inline-flex h-11 items-center justify-center gap-2 rounded-md border text-sm font-semibold transition',
        cls,
        disabled && 'opacity-50 cursor-not-allowed hover:brightness-100',
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} />
      {children}
    </button>
  );
}
