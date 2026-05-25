import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import type { MarketTag } from '@/lib/types';
import { getCurrentProfile } from '@/lib/v4/data';
import { HubTopBar } from '@/components/v4/hub/HubTopBar';
import { V4SynthesisBrowser } from '@/components/v4/market/V4SynthesisBrowser';

export const dynamic = 'force-dynamic';

export default async function HubMarketSynthesisPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: tags }, profile] = await Promise.all([
    supabase
      .from('market_tags')
      .select('id, name, category')
      .order('category').order('name')
      .returns<MarketTag[]>(),
    getCurrentProfile(),
  ]);

  return (
    <>
      <HubTopBar pageLabel="多空綜合" source="supabase" profile={profile} />
      <div className="mx-auto max-w-[1240px] grid gap-6 px-8 py-10 lg:px-14 lg:py-14">
        <Link href="/hub/market" className="inline-flex items-center gap-1.5 font-v4-mono text-xs font-semibold text-ink/55 transition hover:text-ink">
          <ArrowLeft className="h-3 w-3" strokeWidth={2} /> 回市場大腦
        </Link>
        <V4SynthesisBrowser tags={tags ?? []} />
      </div>
    </>
  );
}
