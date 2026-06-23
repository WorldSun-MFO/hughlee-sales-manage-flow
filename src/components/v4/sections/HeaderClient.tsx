'use client';

// Header 區的 inline edit 部分(client island)
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Deal, Profile, StageId, Tier } from '@/lib/v4/types';
import { STAGE_PROB, STAGES } from '@/lib/v4/constants';
import { TIER_STYLES } from '@/lib/v4/utils';
import { InlineText, InlineSelect } from '@/components/v4/InlineEdit';
import { PaymentBadge } from '@/components/v4/sections/PaymentBadge';
import { patchDeal } from '@/lib/v4/mutations';

const TIER_OPTIONS = [
  { value: 'SSS' as Tier, label: 'SSS · 旗艦' },
  { value: 'S' as Tier, label: 'S · 高階' },
  { value: 'A' as Tier, label: 'A · 中階' },
  { value: 'B' as Tier, label: 'B · 初階' },
  { value: 'C' as Tier, label: 'C · 基礎' },
];

export function HeaderClient({
  deal, isFixtures, profile, profiles,
}: {
  deal: Deal;
  isFixtures: boolean;
  profile: Profile | null;
  profiles: Profile[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = () => undefined; // fire-and-forget;不再 router.refresh,改靠本地 optimistic state

  // 可改派的 RM 名單(對齊 deals_update RLS:admin=全部、team_lead=自己團隊、rm=不能改派)
  const role = profile?.role;
  const assignable = !profile ? []
    : role === 'admin' ? profiles
      : role === 'team_lead' ? profiles.filter((p) => p.id === profile.id || (!!profile.team_id && p.team_id === profile.team_id))
        : [];
  const canPickRm = (role === 'admin' || role === 'team_lead') && assignable.length > 1;
  const nameOf = (id: string | null) => {
    if (!id) return '—';
    const p = profiles.find((x) => x.id === id);
    return p?.full_name || p?.email || '—';
  };

  return (
    <header className="grid gap-3">
      <div className="flex items-center gap-2">
        <InlineSelect<Tier>
          value={deal.tier}
          options={TIER_OPTIONS}
          onSave={async (next) => { await patchDeal(deal.id, { tier: next }); refresh(); }}
          isFixtures={isFixtures}
          renderDisplay={(v) => v
            ? <span className={`rounded-sm px-2 py-1 font-v4-mono text-[11px] font-bold ${TIER_STYLES[v]}`}>{v}</span>
            : <span className="rounded-sm border border-ink/15 px-2 py-1 font-v4-mono text-[11px] text-ink/45">設 Tier</span>}
        />
        <InlineSelect<StageId>
          value={deal.stage}
          options={STAGES.map((s) => ({ value: s.id, label: `${s.id} · ${s.name}` }))}
          onSave={async (next) => { if (next) { await patchDeal(deal.id, { stage: next }); refresh(); } }}
          isFixtures={isFixtures}
          renderDisplay={(v) => v
            ? <span className={`stage-${v} rounded-sm px-2 py-1 font-v4-mono text-[11px] font-bold`}>{v} · {STAGE_PROB[v]}%</span>
            : <span className="rounded-sm border border-ink/15 px-2 py-1 font-v4-mono text-[11px] text-ink/45">設階段</span>}
        />
        <span className="font-v4-mono text-[11px] text-ink/45 numeric">DEAL · {deal.id.toUpperCase()}</span>
      </div>

      <InlineText
        value={deal.name.replace(/^【範例】/, '')}
        onSave={async (next) => { await patchDeal(deal.id, { name: next }); refresh(); }}
        isFixtures={isFixtures}
        placeholder="(尚未命名)"
        displayClassName="font-v4-serif text-[44px] font-medium leading-[1.05] tracking-tight text-ink lg:text-[56px]"
      />

      <div className="grid grid-cols-[auto_auto] items-center gap-x-4 gap-y-1 font-v4-mono text-sm text-ink/55 lg:grid-cols-[auto_auto_1fr] lg:gap-x-6">
        <span className="label-caps text-ink/45 self-center">產品</span>
        <InlineText
          value={deal.product ?? ''}
          onSave={async (next) => { await patchDeal(deal.id, { product: next || null }); refresh(); }}
          isFixtures={isFixtures}
          placeholder="(未填產品)"
          displayClassName="font-v4-mono text-sm text-ink"
        />
        <div className="inline-flex flex-wrap items-center gap-2">
          {canPickRm ? (
            <span className="inline-flex items-center gap-1 font-v4-mono text-xs text-ink/45">
              RM ·
              <InlineSelect<string>
                value={deal.rm_id}
                options={assignable.map((p) => ({ value: p.id, label: p.full_name || p.email }))}
                onSave={async (next) => { if (next) { await patchDeal(deal.id, { rm_id: next }); refresh(); } }}
                isFixtures={isFixtures}
                renderDisplay={(v) => <span className="font-semibold text-ink/70">{nameOf(v)}</span>}
              />
            </span>
          ) : (
            <span className="font-v4-mono text-xs text-ink/45">RM · {deal.rm?.full_name ?? '—'}</span>
          )}
          {/* 已收款 / 未收款:只在有設目標成交日時顯示 */}
          {deal.target_close_date && <PaymentBadge received={!!deal.payment_received} />}
        </div>
      </div>
    </header>
  );
}
