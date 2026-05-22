import { getMarketIntel } from '@/lib/v4/data';
import { MarketView } from '@/components/v4/views/MarketView';

export const dynamic = 'force-dynamic';

export default async function WorkspaceMarketPage() {
  const { rows } = await getMarketIntel(20);
  return <MarketView rows={rows} base="/v4/workspace" />;
}
