import { Suspense } from 'react';
import { getSnapshot } from '@/lib/v4/data';
import { PipelineView } from '@/components/v4/views/PipelineView';
import { ListPageSkeleton } from '@/components/v4/skeletons';

export const dynamic = 'force-dynamic';

async function PipelineData() {
  const snap = await getSnapshot();
  return <PipelineView snapshot={snap} base="/workspace" />;
}

export default function WorkspacePipelinePage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <PipelineData />
    </Suspense>
  );
}
