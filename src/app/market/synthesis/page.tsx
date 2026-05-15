import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MarketShell } from '@/components/market/MarketShell';
import { SynthesisBrowser } from '@/components/market/SynthesisBrowser';
import type { MarketTag } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function SynthesisPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: tags } = await supabase
    .from('market_tags')
    .select('id, name, category')
    .order('category')
    .order('name')
    .returns<MarketTag[]>();

  return (
    <MarketShell title="多空綜合" subtitle="選一個標的 → AI 把多家券商觀點綜合成多空判斷">
      <SynthesisBrowser tags={tags ?? []} />
    </MarketShell>
  );
}
