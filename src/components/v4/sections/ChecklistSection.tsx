import type { StageId } from '@/lib/v4/types';
import { getDealChecklist } from '@/lib/v4/data';
import { ChecklistClient } from './ChecklistClient';

export async function ChecklistSection({ dealId, stage, isFixtures }: { dealId: string; stage: StageId; isFixtures: boolean }) {
  const items = await getDealChecklist(dealId);
  return <ChecklistClient dealId={dealId} stage={stage} items={items} isFixtures={isFixtures} />;
}
