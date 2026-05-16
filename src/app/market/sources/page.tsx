import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MarketShell } from '@/components/market/MarketShell';
import { SourcesManager } from '@/components/market/SourcesManager';
import type { IngestSource, Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function SourcesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>();

  const { data: sources } = await supabase
    .from('ingest_sources')
    .select('id, name, kind, url, region, active, last_run_at, last_status, created_at')
    .order('created_at', { ascending: true })
    .returns<IngestSource[]>();

  const canManage = profile?.role === 'admin' || profile?.role === 'team_lead';

  return (
    <MarketShell title="抓取來源管理" subtitle="自動抓取的 RSS 來源(每 3 小時跑一次)">
      <SourcesManager initialSources={sources ?? []} canManage={canManage} />
    </MarketShell>
  );
}
