import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { flattenIntelList } from '@/lib/market/util';
import { MarketShell } from '@/components/market/MarketShell';
import { IntelBrowser } from '@/components/market/IntelBrowser';

export const dynamic = 'force-dynamic';

export default async function MarketHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: rows } = await supabase
    .from('market_intel')
    .select(`
      *,
      intel_tags(market_tags(id, name, category)),
      creator:profiles!market_intel_created_by_fkey(full_name)
    `)
    .order('created_at', { ascending: false });

  const intel = flattenIntelList(rows);

  return (
    <MarketShell title="市場大腦" subtitle={`共 ${intel.length} 筆情報`}>
      <IntelBrowser initialIntel={intel} />
    </MarketShell>
  );
}
