'use client';

// Header 區的 inline edit 部分(client island)
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Deal, Profile, StageId, Tier } from '@/lib/v4/types';
import { STAGE_PROB, STAGES } from '@/lib/v4/constants';
import { TIER_STYLES } from '@/lib/v4/utils';
import { InlineText, InlineSelect, InlineDate, InlineMoney } from '@/components/v4/InlineEdit';
import { PaymentToggle } from '@/components/v4/sections/PaymentBadge';
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
  // 佣金欄位可看 / 可改:公司收佣=僅 admin;業務收佣=admin 或該 deal 的 RM 本人
  // (值的「看見」已由 data 層 maskCommission 強制;這裡決定欄位是否渲染 / 可編輯)
  const canSeeCompany = role === 'admin';
  const canSeeSales = role === 'admin' || deal.rm_id === profile?.id;
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

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-v4-mono text-sm text-ink/55">
        {/* 產品 */}
        <span className="inline-flex items-center gap-1.5">
          <span className="label-caps text-ink/45">產品</span>
          <InlineText
            value={deal.product ?? ''}
            onSave={async (next) => { await patchDeal(deal.id, { product: next || null }); refresh(); }}
            isFixtures={isFixtures}
            placeholder="(未填產品)"
            displayClassName="font-v4-mono text-sm text-ink"
          />
        </span>

        {/* RM */}
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

        {/* 目標成交(移到 RM 右邊) */}
        <span className="inline-flex items-center gap-1 font-v4-mono text-xs text-ink/45">
          <span className="whitespace-nowrap">目標成交 ·</span>
          <InlineDate
            value={deal.target_close_date}
            onSave={async (next) => { await patchDeal(deal.id, { target_close_date: next }); refresh(); }}
            isFixtures={isFixtures}
          />
        </span>

        {/* 預計收款日 */}
        <span className="inline-flex items-center gap-1 font-v4-mono text-xs text-ink/45">
          <span className="whitespace-nowrap">預計收款 ·</span>
          <InlineDate
            value={deal.expected_payment_date ?? null}
            onSave={async (next) => { await patchDeal(deal.id, { expected_payment_date: next }); refresh(); }}
            isFixtures={isFixtures}
          />
        </span>

        {/* 公司收佣(只有 admin 可看 / 改) */}
        {canSeeCompany && (
          <span className="inline-flex items-center gap-1 font-v4-mono text-xs text-ink/45">
            <span className="whitespace-nowrap">公司收佣 ·</span>
            <InlineMoney
              value={deal.company_commission ?? null}
              onSave={async (next) => { await patchDeal(deal.id, { company_commission: next }); refresh(); }}
              isFixtures={isFixtures}
            />
          </span>
        )}

        {/* 業務收佣(只有 admin 或該業務本人可看 / 改) */}
        {canSeeSales && (
          <span className="inline-flex items-center gap-1 font-v4-mono text-xs text-ink/45">
            <span className="whitespace-nowrap">業務收佣 ·</span>
            <InlineMoney
              value={deal.sales_commission ?? null}
              onSave={async (next) => { await patchDeal(deal.id, { sales_commission: next }); refresh(); }}
              isFixtures={isFixtures}
            />
          </span>
        )}

        {/* 已收款 / 未收款(可切換):只在有設目標成交日時顯示 */}
        {deal.target_close_date && (
          <PaymentToggle dealId={deal.id} received={!!deal.payment_received} isFixtures={isFixtures} />
        )}
      </div>
    </header>
  );
}
