import { Suspense } from 'react';
import { getMarketIntel } from '@/lib/v4/data';
import { MarketView } from '@/components/v4/views/MarketView';
import { ListPageSkeleton } from '@/components/v4/skeletons';

export const dynamic = 'force-dynamic';

async function MarketData() {
  const { rows } = await getMarketIntel(20);
  return <MarketView rows={rows} base="/workspace" />;
}

export default function WorkspaceMarketPage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <MarketData />
    </Suspense>
  );
}
