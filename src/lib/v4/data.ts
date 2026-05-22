// ============================================================
// V4 平台資料源 — 取代原 v4-platform 的 SERVICE_ROLE_KEY 直連
// ============================================================
// 走 ws_crm 既有的 server Supabase client(anon key + cookie session),
// RLS 自動過濾:rm 只看自己;team_lead 看同團隊;admin 看全部。
//
// 三種落點:
//   1. IS_DEMO=true(NEXT_PUBLIC_DEMO_MODE)→ 直接回 v4 fixtures(避免打不到 Supabase)
//   2. 沒登入(理論上 middleware 已擋,只是雙保險)→ v4 fixtures
//   3. 正常登入 → 走 Supabase,RLS 過濾後回 snapshot
//
// 為何不沿用 ws_crm 的 page.tsx 那大坨 SQL?
//   - v4 是 view-driven 的 slim subset,需要的關聯比較少
//   - 之後可以針對每個 v4 view 各自做 query 拆分,而非一次撈完整 Dashboard
//     需要的全部關聯
// ============================================================
import { createClient } from '@/lib/supabase/server';
import { IS_DEMO } from '@/lib/demo';
import type { Snapshot, TierConfigItem } from '@/lib/v4/types';
import { DEFAULT_TIER_CONFIG } from '@/lib/v4/constants';
import { fixtureSnapshot } from '@/lib/v4/fixtures';

export async function getSnapshot(): Promise<Snapshot> {
  if (IS_DEMO) return fixtureSnapshot;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return fixtureSnapshot;

    const [dealsRes, profilesRes, tasksRes, teamsRes, settingsRes] = await Promise.all([
      supabase
        .from('deals')
        .select(`
          *,
          scores(*),
          comments(id, deal_id, author_id, body, is_system, is_raw, created_at),
          rm:profiles!deals_rm_id_fkey(id, email, full_name, rm_code, role, team_id)
        `)
        .order('last_updated', { ascending: false }),
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('tasks').select('*').order('due_date', { ascending: true, nullsFirst: false }),
      supabase.from('teams').select('*').order('name'),
      supabase.from('settings').select('tier_config').eq('id', 1).single(),
    ]);

    // settings.tier_config 結構是 { tiers: TierConfigItem[] }(見 lib/types.ts)
    // 拆出 .tiers,沒設定就用 v4 自己的 DEFAULT_TIER_CONFIG
    const tierConfig: TierConfigItem[] =
      (settingsRes.data?.tier_config as { tiers?: TierConfigItem[] } | null)?.tiers
      ?? DEFAULT_TIER_CONFIG;

    return {
      // ws_crm 的 Deal 型別是 v4 Deal 的 superset(多 plan / score_notes / 等)
      // 用 unknown 中介轉型,讓 TS 安心,跑時 v4 只讀子集欄位,多餘的不會用到
      deals: (dealsRes.data ?? []) as unknown as Snapshot['deals'],
      profiles: (profilesRes.data ?? []) as unknown as Snapshot['profiles'],
      tasks: (tasksRes.data ?? []) as unknown as Snapshot['tasks'],
      teams: (teamsRes.data ?? []) as unknown as Snapshot['teams'],
      tierConfig,
      source: 'supabase',
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    // 任何意外(連不上 Supabase、欄位異動、network 抖動)→ 退回 fixtures,
    // 至少 UI 不會壞掉。production 看到 source='fixtures' 就知道要查 log。
    return fixtureSnapshot;
  }
}
