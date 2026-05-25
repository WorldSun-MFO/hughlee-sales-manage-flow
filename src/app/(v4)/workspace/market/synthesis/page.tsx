import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import type { MarketTag } from '@/lib/types';
import { V4SynthesisBrowser } from '@/components/v4/market/V4SynthesisBrowser';

export const dynamic = 'force-dynamic';

export default async function WorkspaceMarketSynthesisPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: tags } = await supabase
    .from('market_tags')
    .select('id, name, category')
    .order('category').order('name')
    .returns<MarketTag[]>();

  return (
    <div className="grid gap-6 px-8 py-10 lg:px-14 lg:py-14">
      <Link href="/workspace/market" className="inline-flex items-center gap-1.5 font-v4-mono text-xs font-semibold text-ink/55 transition hover:text-ink">
        <ArrowLeft className="h-3 w-3" strokeWidth={2} /> 回市場大腦
      </Link>
      <header className="grid gap-2">
        <div className="label-caps text-ink/45">Market · Synthesis</div>
        <h1 className="font-v4-serif text-[44px] font-medium leading-[1.05] tracking-tight text-ink lg:text-[56px]">多空綜合</h1>
        <p className="max-w-2xl text-base leading-7 text-ink/65">選一個標的 → AI 把多家券商觀點綜合成多空判斷</p>
      </header>
      <V4SynthesisBrowser tags={tags ?? []} />
    </div>
  );
}
