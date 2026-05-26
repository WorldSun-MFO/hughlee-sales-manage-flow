import { Suspense } from 'react';
import { getSnapshot } from '@/lib/v4/data';
import { ClientsListView } from '@/components/v4/views/ClientsListView';
import { ListPageSkeleton } from '@/components/v4/skeletons';

export const dynamic = 'force-dynamic';

async function ClientsData() {
  const snap = await getSnapshot();
  return <ClientsListView snapshot={snap} base="/workspace" />;
}

export default function WorkspaceClientsPage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <ClientsData />
    </Suspense>
  );
}
