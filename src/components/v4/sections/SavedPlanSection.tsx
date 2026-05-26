// 顯示已儲存的 deals.plan(若有)— Server component,純粹 fetch + 判斷有沒有 plan
// 對應 ws_crm DealDetail.tsx 第 276–333 行的「AI 產出的成交路徑」區塊。
import { getDealCore } from '@/lib/v4/data';
import { SavedPlanClient } from './SavedPlanClient';

export async function SavedPlanSection({ dealId, isFixtures }: { dealId: string; isFixtures: boolean }) {
  const deal = await getDealCore(dealId);
  if (!deal?.plan) return null;
  return <SavedPlanClient dealId={dealId} plan={deal.plan} isFixtures={isFixtures} />;
}
