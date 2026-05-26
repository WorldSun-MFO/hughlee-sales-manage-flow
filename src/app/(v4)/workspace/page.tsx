import { Suspense } from 'react';
import { getSnapshot } from '@/lib/v4/data';
import { OverviewView } from '@/components/v4/views/OverviewView';
import { TodaySkeleton } from '@/components/v4/skeletons';

export const dynamic = 'force-dynamic';

async function OverviewData() {
  const snap = await getSnapshot();
  return <OverviewView snapshot={snap} base="/workspace" />;
}

export default function WorkspaceHome() {
  return (
    <Suspense fallback={<TodaySkeleton />}>
      <OverviewData />
    </Suspense>
  );
}
