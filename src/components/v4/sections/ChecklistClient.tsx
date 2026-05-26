'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2 } from 'lucide-react';
import type { ChecklistItem, StageId } from '@/lib/v4/types';
import { CHECKLIST } from '@/lib/constants';
import { cn } from '@/lib/v4/utils';
import { toggleChecklistItem } from '@/lib/v4/mutations';

export function ChecklistClient({
  dealId, stage, items: stageItemsCheckedState, isFixtures,
}: {
  dealId: string;
  stage: StageId;
  items: ChecklistItem[];
  isFixtures: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = () => undefined; // fire-and-forget;不再 router.refresh,改靠本地 optimistic state

  const items = CHECKLIST[stage] ?? [];
  if (items.length === 0) return null;
  const checkedCount = items.filter((it) => stageItemsCheckedState.some((c) => c.item_key === it.key && c.checked)).length;
  const allDone = checkedCount === items.length;
  const nextStageIdx = ['L1','L2','L3','L4','L5','L6','L7'].indexOf(stage) + 1;
  const nextStage = (['L1','L2','L3','L4','L5','L6','L7'] as StageId[])[nextStageIdx];

  return (
    <section className="grid gap-3">
      <div className="flex items-baseline justify-between">
        <div className="label-caps text-ink/55">{stage} → {nextStage ?? '—'} 推進 checklist</div>
        <div className="font-v4-mono text-[11px] text-ink/55 numeric">
          {checkedCount} / {items.length} {allDone && nextStage && '✓ 可推進'}
        </div>
      </div>
      <ul className="grid gap-1 rounded-md border border-ink/10 bg-paper p-4">
        {items.map((it) => {
          const checked = stageItemsCheckedState.some((c) => c.item_key === it.key && c.checked);
          return (
            <li key={it.key}>
              <Row dealId={dealId} itemKey={it.key} label={it.label} checked={checked} isFixtures={isFixtures} onChanged={refresh} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Row({
  dealId, itemKey, label, checked, isFixtures, onChanged,
}: {
  dealId: string; itemKey: string; label: string; checked: boolean; isFixtures: boolean; onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  async function toggle() {
    if (busy || isFixtures) return;
    setBusy(true);
    try { await toggleChecklistItem(dealId, itemKey, !checked); onChanged(); }
    finally { setBusy(false); }
  }
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy || isFixtures}
      className="grid w-full grid-cols-[auto_1fr] items-start gap-2 rounded-sm px-1.5 py-1.5 text-left transition hover:bg-cream/40 disabled:cursor-not-allowed"
    >
      <span className={cn(
        'mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-sm border transition',
        checked ? 'border-forest bg-forest text-paper' : 'border-ink/30 bg-paper',
      )}>
        {busy ? <Loader2 className="h-2.5 w-2.5 animate-spin" strokeWidth={2.5} /> : checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className={cn('text-sm leading-6', checked ? 'text-ink/55 line-through' : 'text-ink/85')}>{label}</span>
    </button>
  );
}
