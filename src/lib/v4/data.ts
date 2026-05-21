import { createClient } from '@supabase/supabase-js';
import type { Deal, Profile, Snapshot, Task, Team } from '@/lib/v4/types';
import { DEFAULT_TIER_CONFIG } from '@/lib/v4/constants';
import { fixtureSnapshot } from '@/lib/v4/fixtures';

// Server-only data fetcher.
// If both NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set,
// pulls from the real Supabase project. Otherwise falls back to demo fixtures.
// SERVICE_ROLE_KEY is acceptable here because v4-platform is a layout sandbox
// against fake data — never use this pattern against production.

export async function getSnapshot(): Promise<Snapshot> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fixtureSnapshot;

  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });

    const [{ data: deals }, { data: profiles }, { data: tasks }, { data: teams }] = await Promise.all([
      supabase
        .from('deals')
        .select('*, scores(*), comments(id, deal_id, author_id, body, is_system, is_raw, created_at), rm:profiles!deals_rm_id_fkey(id, email, full_name, rm_code, role, team_id)')
        .order('last_updated', { ascending: false }),
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('tasks').select('*').order('due_date', { ascending: true, nullsFirst: false }),
      supabase.from('teams').select('*').order('name'),
    ]);

    return {
      deals: (deals as Deal[] | null) ?? [],
      profiles: (profiles as Profile[] | null) ?? [],
      tasks: (tasks as Task[] | null) ?? [],
      teams: (teams as Team[] | null) ?? [],
      tierConfig: DEFAULT_TIER_CONFIG,
      source: 'supabase',
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return fixtureSnapshot;
  }
}
