// Stats 區塊 — 純展示,不需要 client interactivity
import { Phone } from 'lucide-react';
import type { Deal, TierConfigItem } from '@/lib/v4/types';
import { contactOverdue, daysSince, fmtMoney, redFlag, totalScore } from '@/lib/v4/utils';

export function StatsRow({ deal }: { deal: Deal }) {
  const score = totalScore(deal);
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Stat label="AUM" value={fmtMoney(Number(deal.aum_usd))} />
      <Stat label="MEDDIC" value={`${score} / 80`} />
      <Stat label="最後更新" value={`${daysSince(deal.last_updated)} 天前`} />
      <Stat label="最後聯繫" value={deal.last_contact_at ? `${daysSince(deal.last_contact_at)} 天前` : '—'} />
    </section>
  );
}

export function AlertsRow({ deal, tierConfig }: { deal: Deal; tierConfig: TierConfigItem[] }) {
  const rf = redFlag(deal);
  const ci = contactOverdue(deal, tierConfig);
  if (!rf && ci?.status !== 'overdue') return null;
  return (
    <div className="grid gap-2">
      {rf && (
        <div className="flex items-center gap-2 rounded-md border border-claret/30 bg-claret/8 px-4 py-3 text-sm font-semibold text-claret">
          <span className="text-base">🚩</span> {rf}
        </div>
      )}
      {ci?.status === 'overdue' && (
        <div className="flex items-center gap-2 rounded-md border border-brass/40 bg-brass/10 px-4 py-3 text-sm font-semibold text-brass">
          <Phone className="h-4 w-4" strokeWidth={1.75} /> 已逾期 {ci.deltaDays} 天未聯繫
        </div>
      )}
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
