import { getSnapshot } from '@/lib/v4/data';
import { HubTopBar } from '@/components/v4/hub/HubTopBar';
import { ClientDetailView } from '@/components/v4/views/ClientDetailView';

export const dynamic = 'force-dynamic';

export default async function HubClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const snap = await getSnapshot();
  const { id } = await params;
  return (
    <>
      <HubTopBar pageLabel="客戶詳情" source={snap.source} />
      <div className="mx-auto max-w-[1240px]">
        <ClientDetailView snapshot={snap} dealId={id} base="/v4/hub" backHref="/v4/hub/clients" />
      </div>
    </>
  );
}
