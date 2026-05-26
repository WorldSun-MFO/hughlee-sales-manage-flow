'use client';

// ============================================================
// 客戶聯繫提醒卡 — 取代原 ws_crm DealDetail 的「客戶等級 + 聯繫提醒」slate 卡
// 在 v4 把 tier 拉去 HeaderClient,這裡只負責「最後聯繫日 + 狀態」一塊
// ============================================================
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Phone, Shield } from 'lucide-react';
import type { Deal, TierConfigItem } from '@/lib/v4/types';
import { contactOverdue, daysSince, cn } from '@/lib/v4/utils';
import { setLastContactAt } from '@/lib/v4/mutations';

export function LastContactSection({
  deal,
  tierConfig,
  isFixtures,
}: {
  deal: Deal;
  tierConfig: TierConfigItem[];
  isFixtures: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = () => undefined; // fire-and-forget;不再 router.refresh,改靠本地 optimistic state

  const initialDate = deal.last_contact_at ? deal.last_contact_at.slice(0, 10) : '';
  const [draft, setDraft] = useState(initialDate);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ci = contactOverdue(deal, tierConfig);
  const tierCfgItem = deal.tier ? tierConfig.find((t) => t.key === deal.tier) : null;

  async function commitDate(value: string) {
    if (isFixtures) return;
    setErr(null);
    const iso = value ? new Date(value).toISOString() : null;
    // 沒變就跳過
    if ((iso ?? null) === (deal.last_contact_at ?? null)) return;
    setBusy(true);
    try {
      await setLastContactAt(deal.id, iso);
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '更新失敗');
      setDraft(initialDate);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-md border border-ink/10 bg-cream/40 p-4">
      <div className="flex items-center gap-2">
        <Shield className="h-3.5 w-3.5 text-ink/55" strokeWidth={1.75} />
        <span className="label-caps text-ink/55">聯繫提醒</span>
        {tierCfgItem && (
          <span className="font-v4-mono text-[11px] text-ink/45">
            · {tierCfgItem.name} · 建議每 {tierCfgItem.contact_days} 天聯繫
          </span>
        )}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {/* 左:最後聯繫日 */}
        <div className="grid gap-1.5">
          <span className="label-caps text-ink/45">最後聯繫日</span>
          <input
            type="date"
            defaultValue={draft}
            disabled={isFixtures || busy}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => commitDate(e.target.value)}
            className={cn(
              'rounded-sm border border-ink/15 bg-paper px-2 py-1.5 font-v4-mono text-sm text-ink',
              'hover:border-ink/30 focus:border-ink/50 focus:outline-none',
              (isFixtures || busy) && 'cursor-not-allowed opacity-60',
            )}
          />
          {err && <span className="font-v4-mono text-[11px] text-claret">{err}</span>}
        </div>

        {/* 右:狀態 badge */}
        <div className="grid gap-1.5">
          <span className="label-caps text-ink/45">聯繫狀態</span>
          <StatusBadge deal={deal} info={ci} />
        </div>
      </div>
    </section>
  );
}

function StatusBadge({
  deal,
  info,
}: {
  deal: Deal;
  info: ReturnType<typeof contactOverdue>;
}) {
  if (!info) {
    return (
      <span className="inline-flex items-center gap-1.5 self-start rounded-sm border border-ink/15 bg-paper px-2 py-1.5 font-v4-mono text-xs text-ink/45">
        {deal.last_contact_at ? '尚未設定 Tier' : '尚未記錄聯繫'}
      </span>
    );
  }
  if (info.status === 'overdue') {
    return (
      <span className="inline-flex items-center gap-1.5 self-start rounded-sm border border-claret/30 bg-claret/8 px-2 py-1.5 font-v4-mono text-xs font-semibold text-claret">
        <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.75} />
        已逾期 {info.deltaDays} 天未聯繫
      </span>
    );
  }
  if (info.status === 'due_soon') {
    return (
      <span className="inline-flex items-center gap-1.5 self-start rounded-sm border border-brass/40 bg-brass/10 px-2 py-1.5 font-v4-mono text-xs font-semibold text-brass">
        <Phone className="h-3.5 w-3.5" strokeWidth={1.75} />
        {Math.abs(info.deltaDays)} 天內需聯繫
      </span>
    );
  }
  // ok
  const sinceDays = deal.last_contact_at ? daysSince(deal.last_contact_at) : 0;
  return (
    <span className="inline-flex items-center gap-1.5 self-start rounded-sm border border-forest/30 bg-forest/8 px-2 py-1.5 font-v4-mono text-xs font-semibold text-forest">
      <Phone className="h-3.5 w-3.5" strokeWidth={1.75} />
      ✓ 已聯繫 {sinceDays} 天(週期內)
    </span>
  );
}
