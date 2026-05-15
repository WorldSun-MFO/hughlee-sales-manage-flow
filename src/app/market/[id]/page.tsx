import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { flattenIntel } from '@/lib/market/util';
import { MarketShell } from '@/components/market/MarketShell';
import { IntelDetailView } from '@/components/market/IntelDetailView';
import type { MarketTag, Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function IntelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: row } = await supabase
    .from('market_intel')
    .select(`
      *,
      intel_tags(market_tags(id, name, category)),
      creator:profiles!market_intel_created_by_fkey(full_name)
    `)
    .eq('id', id)
    .maybeSingle();

  if (!row) notFound();
  const intel = flattenIntel(row);

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>();

  const { data: tags } = await supabase
    .from('market_tags')
    .select('id, name, category')
    .order('name')
    .returns<MarketTag[]>();

  const canEdit = intel.created_by === user.id || profile?.role === 'admin';

  return (
    <MarketShell title="情報詳情" subtitle={intel.title}>
      <IntelDetailView intel={intel} canEdit={canEdit} existingTags={tags ?? []} />
    </MarketShell>
  );
}
