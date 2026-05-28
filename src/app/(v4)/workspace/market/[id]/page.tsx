import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { flattenIntel } from '@/lib/market/util';
import { IntelDetailV4 } from '@/components/v4/market/IntelDetailV4';
import type { MarketTag, Profile, DealLite } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function WorkspaceIntelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: row } = await supabase
    .from('market_intel')
    .select(`*,
      intel_tags(market_tags(id, name, category)),
      intel_deal_links(relevance_reason, deal:deals(id, name)),
      creator:profiles!market_intel_created_by_fkey(full_name)`)
    .eq('id', id)
    .maybeSingle();
  if (!row) notFound();
  const intel = flattenIntel(row);

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single<Profile>();
  const { data: tags } = await supabase.from('market_tags').select('id, name, category').order('name').returns<MarketTag[]>();
  const { data: deals } = await supabase.from('deals').select('id, name, product, stage').order('last_updated', { ascending: false }).returns<DealLite[]>();
  const canEdit = intel.created_by === user.id || profile?.role === 'admin';

  return <IntelDetailV4 intel={intel} canEdit={canEdit} existingTags={tags ?? []} deals={deals ?? []} base="/workspace" />;
}
