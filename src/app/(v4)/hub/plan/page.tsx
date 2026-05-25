import { getCurrentProfile, getSnapshot } from '@/lib/v4/data';
import { HubTopBar } from '@/components/v4/hub/HubTopBar';
import { PlanView } from '@/components/v4/views/PlanView';

export const dynamic = 'force-dynamic';

export default async function HubPlanPage() {
  const [snap, profile] = await Promise.all([getSnapshot(), getCurrentProfile()]);
  return (
    <>
      <HubTopBar pageLabel="成交路徑規劃" source={snap.source} profile={profile} />
      <div className="mx-auto max-w-[1240px]">
        <PlanView snapshot={snap} base="/hub" />
      </div>
    </>
  );
}
