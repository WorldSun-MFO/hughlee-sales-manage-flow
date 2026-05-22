import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import type { IngestSource, Profile } from '@/lib/types';
import { HubTopBar } from '@/components/v4/hub/HubTopBar';
import { V4SourcesManager } from '@/components/v4/market/V4SourcesManager';

export const dynamic = 'force-dynamic';

export default async function HubMarketSourcesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single<Profile>();
  const { data: sources } = await supabase
    .from('ingest_sources')
    .select('id, name, kind, url, region, active, last_run_at, last_status, created_at')
    .order('created_at', { ascending: true })
    .returns<IngestSource[]>();
  const canManage = profile?.role === 'admin' || profile?.role === 'team_lead';

  return (
    <>
      <HubTopBar pageLabel="抓取來源管理" source="supabase" />
      <div className="mx-auto max-w-[1240px] grid gap-6 px-8 py-10 lg:px-14 lg:py-14">
        <Link href="/v4/hub/market" className="inline-flex items-center gap-1.5 font-v4-mono text-xs font-semibold text-ink/55 transition hover:text-ink">
          <ArrowLeft className="h-3 w-3" strokeWidth={2} /> 回市場大腦
        </Link>
        <V4SourcesManager initialSources={sources ?? []} canManage={canManage} />
      </div>
    </>
  );
}
