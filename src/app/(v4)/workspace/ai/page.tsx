import { Suspense } from 'react';
import { getSnapshot } from '@/lib/v4/data';
import { AIChatView } from '@/components/v4/views/AIChatView';
import { ListPageSkeleton } from '@/components/v4/skeletons';

export const dynamic = 'force-dynamic';

async function AIData() {
  const snap = await getSnapshot();
  return <AIChatView snapshot={snap} base="/workspace" />;
}

export default function WorkspaceAIPage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <AIData />
    </Suspense>
  );
}
