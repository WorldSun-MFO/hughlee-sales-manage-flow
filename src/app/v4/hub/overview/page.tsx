import { getSnapshot } from '@/lib/v4/data';
import { HubTopBar } from '@/components/v4/hub/HubTopBar';
import { OverviewView } from '@/components/v4/views/OverviewView';

export const dynamic = 'force-dynamic';

export default async function HubOverviewPage() {
  const snap = await getSnapshot();
  return (
    <>
      <HubTopBar pageLabel="總覽" source={snap.source} />
      <div className="mx-auto max-w-[1240px]">
        <OverviewView snapshot={snap} base="/v4/hub" />
      </div>
    </>
  );
}
