import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MarketShell } from '@/components/market/MarketShell';
import { IntelForm } from '@/components/market/IntelForm';
import type { MarketTag } from '@/lib/types';

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

  return (
    <MarketShell title="新增市場情報" subtitle="手動建檔(Phase 2 起可貼研報讓 AI 自動摘要)">
      <IntelForm mode="create" existingTags={tags ?? []} />
    </MarketShell>
  );
}
