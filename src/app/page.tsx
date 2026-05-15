import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Dashboard } from '@/components/Dashboard';
import { DEFAULT_TIER_CONFIG } from '@/lib/constants';
import type { Deal, PainPoint, Profile, Settings, Task, Team } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>();

  const { data: deals } = await supabase
    .from('deals')
    .select(`
      *,
      scores(*),
      score_notes(*),
      stage_checklist(*),
      deal_questions(*),
      comments(id, deal_id, author_id, body, is_system, created_at),
      rm:profiles!deals_rm_id_fkey(id, email, full_name, rm_code, role)
    `)
    .order('last_updated', { ascending: false })
    .returns<Deal[]>();

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .order('full_name')
    .returns<Profile[]>();

  const { data: painPoints } = await supabase
    .from('pain_points')
    .select('*')
    .eq('is_active', true)
    .order('order_idx')
    .returns<PainPoint[]>();

  const { data: teams } = await supabase
    .from('teams')
    .select('*')
    .order('name')
    .returns<Team[]>();

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .order('due_date', { ascending: true, nullsFirst: false })
    .returns<Task[]>();

  const { data: settings } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 1)
    .single<Settings>();

  return (
    <Dashboard
      initialDeals={deals ?? []}
      profile={profile!}
      allProfiles={profiles ?? []}
      initialPainPoints={painPoints ?? []}
      initialTeams={teams ?? []}
      initialTasks={tasks ?? []}
      settings={settings ?? { id: 1, stage_probs: { L1:7,L2:13,L3:20,L4:44,L5:68,L6:90,L7:100 }, red_flag: { ebScore: 4, totalScore: 40, staleDays: 30 }, tier_config: { tiers: DEFAULT_TIER_CONFIG } }}
    />
  );
}
