// ============================================================
// 主畫面 SSR 入口 — 一頁式 CRM 的「Server 端裝載器」
// ============================================================
// 流程:
//   1. middleware 已先驗 cookie → 若未登入會被導向 /login,走不到這裡
//   2. 這裡用 server-side Supabase client 一次撈齊整個 Dashboard 需要的
//      所有資料(deals + join + profiles + pain_points + teams + tasks +
//      settings),透過 RLS 自動過濾(RM 只拿自己的,team_lead 拿同團隊,
//      admin 拿全部)
//   3. 整包塞給 <Dashboard> Client Component;之後所有讀寫由 browser
//      Supabase client 直連 Supabase(realtime 也是)
//
// 為何 force-dynamic:每次重新整理都要拿最新 deals,不能靜態化。
//
// Demo 模式分支:不碰 Supabase,直接用 lib/demo/fixtures 的假資料渲染。
// ============================================================
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Dashboard } from '@/components/Dashboard';
import { DEFAULT_TIER_CONFIG } from '@/lib/constants';
import type { Deal, PainPoint, Profile, Settings, Task, Team } from '@/lib/types';
import { IS_DEMO } from '@/lib/demo';

export const dynamic = 'force-dynamic';

// 登入後驗證人員階層,抓該階層全部資料表,塞進 /components/Dashboard.tsx
export default async function Home() {
  // DEMO 模式:完全不碰 Supabase,直接用內建假資料渲染。
  // 正式環境沒有 NEXT_PUBLIC_DEMO_MODE → IS_DEMO=false → 跳過,走下方原邏輯。
  if (IS_DEMO) {
    const { demoDeals, demoProfile, demoProfiles, demoPainPoints, demoTeams, demoTasks, demoSettings } =
      await import('@/lib/demo/fixtures');
    return (
      <Dashboard
        initialDeals={demoDeals}
        profile={demoProfile}
        allProfiles={demoProfiles}
        initialPainPoints={demoPainPoints}
        initialTeams={demoTeams}
        initialTasks={demoTasks}
        settings={demoSettings}
      />
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 登入者自己的 profile(角色、團隊歸屬;Dashboard 用來判斷可不可以改別人的 deal)
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>();

  // 主 join 查詢 — 一次抓齊整個 CRM 畫面需要的東西。
  // RLS 自動過濾:rm 只看自己;team_lead 看同團隊;admin 看全部。
  // 注意:這個 select 字串改動會牽動整個 Dashboard 渲染,refetch (Dashboard.tsx)
  //      也必須同步,不然 realtime 重抓時欄位就會缺。
  const { data: deals } = await supabase
    .from('deals')
    .select(`
      *,
      scores(*),
      score_notes(*),
      stage_checklist(*),
      deal_questions(*),
      deal_attachments(*),
      comments(id, deal_id, author_id, body, is_system, is_raw, created_at),
      rm:profiles!deals_rm_id_fkey(id, email, full_name, rm_code, role)
    `)
    .order('last_updated', { ascending: false })
    .returns<Deal[]>();

  // 全成員清單(RM 下拉、團隊分組、指派任務用)
  // profiles_read policy:authenticated 都可讀,所以這份每個人都看得到全部
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .order('full_name')
    .returns<Profile[]>();

  // 痛點對應商品(顯示在 DealDetail 給 RM 翻找)
  const { data: painPoints } = await supabase
    .from('pain_points')
    .select('*')
    .eq('is_active', true)
    .order('order_idx')
    .returns<PainPoint[]>();

  // 團隊清單(下拉選單、Header 顯示「WS Team / Daniel Team」等)
  const { data: teams } = await supabase
    .from('teams')
    .select('*')
    .order('name')
    .returns<Team[]>();

  // 跨案件任務(TasksTab + 「🎯 今日追蹤清單」用到)
  // RLS:assignee_id = me OR created_by = me OR can_access_deal(deal_id) OR admin
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .order('due_date', { ascending: true, nullsFirst: false })
    .returns<Task[]>();

  // 全站設定(singleton id=1):階段機率 + 紅旗門檻 + tier 配置
  // 任何人讀,只有 admin 寫(settings_update policy)
  const { data: settings } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 1)
    .single<Settings>();

  // settings 若不存在(極少數情境),用 hard-coded fallback;
  // 正式環境 settings.id=1 是 seed 進去的,不會走到 fallback。
  return (
    <Dashboard
      initialDeals={deals ?? []}
      profile={profile!}
      allProfiles={profiles ?? []}
      initialPainPoints={painPoints ?? []}
      initialTeams={teams ?? []}
      initialTasks={tasks ?? []}
      settings={settings ?? { id: 1, stage_probs: { L1: 7, L2: 13, L3: 20, L4: 44, L5: 68, L6: 90, L7: 100 }, red_flag: { ebScore: 4, totalScore: 40, staleDays: 30 }, tier_config: { tiers: DEFAULT_TIER_CONFIG } }}
    />
  );
}
