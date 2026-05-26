import { Suspense } from 'react';
import { getSnapshot } from '@/lib/v4/data';
import { PlanView } from '@/components/v4/views/PlanView';
import { ListPageSkeleton } from '@/components/v4/skeletons';

export const dynamic = 'force-dynamic';

async function PlanData() {
  const snap = await getSnapshot();
  return <PlanView snapshot={snap} base="/workspace" />;
}

export default function WorkspacePlanPage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <PlanData />
    </Suspense>
  );
}
