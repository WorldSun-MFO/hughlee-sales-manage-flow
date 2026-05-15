import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MarketShell } from '@/components/market/MarketShell';
import { MarketComposer } from '@/components/market/MarketComposer';
import type { MarketTag, DealLite } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function NewIntelPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: tags } = await supabase
    .from('market_tags')
    .select('id, name, category')
    .order('name')
    .returns<MarketTag[]>();

  const { data: deals } = await supabase
    .from('deals')
    .select('id, name, product, stage')
    .order('last_updated', { ascending: false })
    .returns<DealLite[]>();

  return (
    <MarketShell title="新增市場情報" subtitle="貼研報/網址讓 AI 一鍵摘要 + 建議關聯客戶">
      <MarketComposer existingTags={tags ?? []} deals={deals ?? []} />
    </MarketShell>
  );
}
