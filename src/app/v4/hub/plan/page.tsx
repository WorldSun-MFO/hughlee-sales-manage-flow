import { getSnapshot } from '@/lib/v4/data';
import { HubTopBar } from '@/components/v4/hub/HubTopBar';
import { PlanView } from '@/components/v4/views/PlanView';

export const dynamic = 'force-dynamic';

export default async function HubPlanPage() {
  const snap = await getSnapshot();
  return (
    <>
      <HubTopBar pageLabel="成交路徑規劃" source={snap.source} />
      <div className="mx-auto max-w-[1240px]">
        <PlanView snapshot={snap} base="/v4/hub" />
      </div>
    </>
  );
}
