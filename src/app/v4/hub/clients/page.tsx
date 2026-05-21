import { getSnapshot } from '@/lib/v4/data';
import { HubTopBar } from '@/components/v4/hub/HubTopBar';
import { ClientsListView } from '@/components/v4/views/ClientsListView';

export const dynamic = 'force-dynamic';

export default async function HubClientsPage() {
  const snap = await getSnapshot();
  return (
    <>
      <HubTopBar pageLabel="客戶名冊" source={snap.source} />
      <div className="mx-auto max-w-[1240px]">
        <ClientsListView snapshot={snap} base="/v4/hub" />
      </div>
    </>
  );
}
