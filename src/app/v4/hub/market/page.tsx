import { getSnapshot } from '@/lib/v4/data';
import { HubTopBar } from '@/components/v4/hub/HubTopBar';
import { MarketView } from '@/components/v4/views/MarketView';

export const dynamic = 'force-dynamic';

export default async function HubMarketPage() {
  const snap = await getSnapshot();
  return (
    <>
      <HubTopBar pageLabel="市場大腦" source={snap.source} />
      <div className="mx-auto max-w-[1240px]">
        <MarketView />
      </div>
    </>
  );
}
