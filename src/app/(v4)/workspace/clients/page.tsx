import { Suspense } from 'react';
import { getSnapshot, getCurrentProfile } from '@/lib/v4/data';
import { ClientsListView } from '@/components/v4/views/ClientsListView';
import { ListPageSkeleton } from '@/components/v4/skeletons';

export const dynamic = 'force-dynamic';

async function ClientsData() {
  const [snap, profile] = await Promise.all([getSnapshot(), getCurrentProfile()]);
  return <ClientsListView snapshot={snap} base="/workspace" profile={profile} />;
}

export default function WorkspaceClientsPage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <ClientsData />
    </Suspense>
  );
}
