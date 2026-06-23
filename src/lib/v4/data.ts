// ============================================================
// V4 資料層 — 拆成 targeted fetchers + React.cache
// ============================================================
// 演變:
//   v1: getSnapshot() 一次抓 deals + 7 joins + profiles + tasks + teams + settings
//       → 整包傳回前端 → 列表頁 / 詳情頁 / 設定頁全部吃同一份 fat snapshot
//       → 100+ 案件 + 多 join 時可能幾 MB,網頁卡 5+ 秒
//
//   v2(this file):每個 view 自己挑要的資料抓:
//       - getDealsLight()    列表頁專用,輕量 join
//       - getDealCore(id)    詳情頁 header / 基本欄位
//       - getDealScores(id)  詳情頁 MEDDIC section
//       - getDealComments(id) 詳情頁活動紀錄
//       - getDealAttachments(id)
//       - getDealChecklist(id)
//       - getDealQuestions(id)
//       - getDealTasks(id)   單一案件的任務
//       - getTasks()         所有任務(Today 用)
//       - getProfilesAndTeams() 所有 view 共用的下拉資料
//       - getSettings()      Settings 頁
//       - getCurrentProfile() 各頁 role gating
//       - getMemberStatus()  Settings 頁 admin section
//       - getMarketIntel()   Market 頁
//
//   每個函式用 React.cache() 包,同一 request 內重複呼叫只實際跑一次。
//   配合 <Suspense> 各 section 獨立 stream,使用者看到頁面骨架立刻可動。
//
//   getSnapshot() 為向後相容保留(刪掉會壞既有 view),但呼叫各 targeted
//   fetcher 拼裝。新 code 一律用 targeted fetcher。
// ============================================================
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { IS_DEMO } from '@/lib/demo';
import type {
  Comment, Deal, DealAttachment, DealQuestion, ChecklistItem,
  Profile, Scores, ScoreNote, Snapshot, Task, Team, TierConfigItem,
} from '@/lib/v4/types';
import { DEFAULT_TIER_CONFIG } from '@/lib/v4/constants';
import { fixtureSnapshot } from '@/lib/v4/fixtures';

// ============================================================
// 共用 helper:取 authenticated supabase 或 null
// ============================================================
// auth.getUser() 是一趟到 Supabase Auth 的網路驗證。集中在這裡並用 React.cache 包,
// 讓同一次 render 內所有 fetcher(getAuthed)與 getCurrentProfile 共用「一次驗證」,
// 不再各打各的(原本 layout 的 getCurrentProfile + 頁面的 getAuthed 會驗兩次)。
const getAuthContext = cache(async (): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; userId: string } | null> => {
  if (IS_DEMO) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, userId: user.id };
});

const getAuthed = cache(async () => (await getAuthContext())?.supabase ?? null);

// ============================================================
// 列表頁專用:輕量版 deals(沒 comments / attachments / checklist / questions)
// ============================================================
export type LightDeal = Pick<Deal,
  'id' | 'name' | 'rm_id' | 'aum_usd' | 'product' |
  'first_contact' | 'last_updated' | 'last_contact_at' |
  'tier' | 'stage' | 'next_step' | 'target_close_date' | 'expected_payment_date' | 'payment_received' | 'created_at'
> & {
  scores?: Scores;
  rm?: Pick<Profile, 'id' | 'email' | 'full_name' | 'rm_code' | 'role' | 'team_id'> | null;
};

export const getDealsLight = cache(async (): Promise<LightDeal[]> => {
  const supabase = await getAuthed();
  if (!supabase) return fixtureSnapshot.deals as LightDeal[];
  const { data, error } = await supabase
    .from('deals')
    .select(`
      id, name, rm_id, aum_usd, product, first_contact, last_updated,
      last_contact_at, tier, stage, next_step, target_close_date, expected_payment_date, payment_received, created_at,
      scores(*),
      rm:profiles!deals_rm_id_fkey(id, email, full_name, rm_code, role, team_id)
    `)
    .order('last_updated', { ascending: false });
  if (error) return [];
  return (data ?? []) as unknown as LightDeal[];
});

// ============================================================
// 詳情頁:per-section fetcher(每個 section 各跑各的,並行)
// ============================================================
export const getDealCore = cache(async (dealId: string): Promise<Deal | null> => {
  const supabase = await getAuthed();
  if (!supabase) return (fixtureSnapshot.deals.find((d) => d.id === dealId) as Deal | undefined) ?? null;
  const { data, error } = await supabase
    .from('deals')
    .select(`
      *,
      rm:profiles!deals_rm_id_fkey(id, email, full_name, rm_code, role, team_id)
    `)
    .eq('id', dealId)
    .single();
  if (error) return null;
  return data as unknown as Deal;
});

export const getDealScores = cache(async (dealId: string): Promise<{ scores: Scores | null; notes: ScoreNote[] }> => {
  const supabase = await getAuthed();
  if (!supabase) return { scores: null, notes: [] };
  const [scoresRes, notesRes] = await Promise.all([
    supabase.from('scores').select('*').eq('deal_id', dealId).maybeSingle(),
    supabase.from('score_notes').select('*').eq('deal_id', dealId),
  ]);
  return {
    scores: (scoresRes.data as Scores | null) ?? null,
    notes: (notesRes.data as ScoreNote[] | null) ?? [],
  };
});

export const getDealComments = cache(async (dealId: string): Promise<Comment[]> => {
  const supabase = await getAuthed();
  if (!supabase) return [];
  const { data } = await supabase
    .from('comments')
    .select('id, deal_id, author_id, body, is_system, is_raw, raw_body, created_at')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false });
  return (data as Comment[] | null) ?? [];
});

export const getDealAttachments = cache(async (dealId: string): Promise<DealAttachment[]> => {
  const supabase = await getAuthed();
  if (!supabase) return [];
  const { data } = await supabase
    .from('deal_attachments')
    .select('*')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false });
  return (data as DealAttachment[] | null) ?? [];
});

// 為圖片附檔預先產 signed URL,讓客戶詳情頁可以直接 <img> 顯示縮圖
export const getAttachmentImageUrls = cache(async (atts: DealAttachment[]): Promise<Record<string, string>> => {
  const supabase = await getAuthed();
  if (!supabase) return {};
  const out: Record<string, string> = {};
  const imageAtts = atts.filter((a) => a.mime_type.startsWith('image/'));
  await Promise.all(imageAtts.map(async (a) => {
    const { data } = await supabase.storage.from('deal-attachments').createSignedUrl(a.storage_path, 3600);
    if (data?.signedUrl) out[a.id] = data.signedUrl;
  }));
  return out;
});

// pain_points 表(admin 在 SettingsModal 維護的痛點 → 商品配對)
export const getPainPoints = cache(async (): Promise<import('./types').PainPoint[]> => {
  const supabase = await getAuthed();
  if (!supabase) return [];
  const { data } = await supabase
    .from('pain_points')
    .select('*')
    .eq('is_active', true)
    .order('order_idx');
  return (data as import('./types').PainPoint[] | null) ?? [];
});

export const getDealChecklist = cache(async (dealId: string): Promise<ChecklistItem[]> => {
  const supabase = await getAuthed();
  if (!supabase) return [];
  const { data } = await supabase
    .from('stage_checklist')
    .select('*')
    .eq('deal_id', dealId);
  return (data as ChecklistItem[] | null) ?? [];
});

export const getDealQuestions = cache(async (dealId: string): Promise<DealQuestion[]> => {
  const supabase = await getAuthed();
  if (!supabase) return [];
  const { data } = await supabase
    .from('deal_questions')
    .select('*')
    .eq('deal_id', dealId);
  return (data as DealQuestion[] | null) ?? [];
});

export const getDealTasks = cache(async (dealId: string): Promise<Task[]> => {
  const supabase = await getAuthed();
  if (!supabase) return [];
  const { data } = await supabase
    .from('tasks')
    .select('*')
    .eq('deal_id', dealId)
    .order('due_date', { ascending: true, nullsFirst: false });
  return (data as Task[] | null) ?? [];
});

// ============================================================
// 跨案件 / 全域資料
// ============================================================
export const getTasks = cache(async (): Promise<Task[]> => {
  const supabase = await getAuthed();
  if (!supabase) return fixtureSnapshot.tasks;
  const { data } = await supabase
    .from('tasks')
    .select('*')
    .order('due_date', { ascending: true, nullsFirst: false });
  return (data as Task[] | null) ?? [];
});

export const getProfilesAndTeams = cache(async (): Promise<{
  profiles: Profile[]; teams: Team[];
}> => {
  const supabase = await getAuthed();
  if (!supabase) return { profiles: fixtureSnapshot.profiles, teams: fixtureSnapshot.teams };
  const [profilesRes, teamsRes] = await Promise.all([
    supabase.from('profiles').select('*').order('full_name'),
    supabase.from('teams').select('*').order('name'),
  ]);
  return {
    profiles: (profilesRes.data as Profile[] | null) ?? [],
    teams: (teamsRes.data as Team[] | null) ?? [],
  };
});

export const getTierConfig = cache(async (): Promise<TierConfigItem[]> => {
  const supabase = await getAuthed();
  if (!supabase) return DEFAULT_TIER_CONFIG;
  const { data } = await supabase.from('settings').select('tier_config').eq('id', 1).single();
  return (data?.tier_config as { tiers?: TierConfigItem[] } | null)?.tiers ?? DEFAULT_TIER_CONFIG;
});

// ============================================================
// Settings 頁專用
// ============================================================
export interface SettingsRow {
  id: 1;
  stage_probs: Record<string, number>;
  red_flag: { ebScore: number; totalScore: number; staleDays: number; contactWarnDays?: number };
  tier_config: { tiers: TierConfigItem[] };
}

export const getSettings = cache(async (): Promise<SettingsRow | null> => {
  const supabase = await getAuthed();
  if (!supabase) return null;
  const { data } = await supabase.from('settings').select('*').eq('id', 1).single();
  return (data as SettingsRow | null) ?? null;
});

export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const ctx = await getAuthContext();   // 共用同一次 auth 驗證,不再額外打一趟 getUser
  if (!ctx) return null;
  try {
    const { data } = await ctx.supabase.from('profiles').select('*').eq('id', ctx.userId).single();
    return (data as Profile | null) ?? null;
  } catch { return null; }
});

export type MemberStatusMap = Record<string, { has_auth: boolean; banned: boolean }>;
export const getMemberStatus = cache(async (): Promise<MemberStatusMap> => {
  if (IS_DEMO) return {};
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('admin_member_status');
    if (error) return {};
    const rows = (data ?? []) as Array<{ id: string; has_auth: boolean; banned: boolean }>;
    return Object.fromEntries(rows.map((r) => [r.id, { has_auth: r.has_auth, banned: r.banned }]));
  } catch { return {}; }
});

// ============================================================
// Market 頁
// ============================================================
export type IntelRegion = 'TW' | 'US' | 'JP' | 'CN' | 'GLOBAL';
export type IntelStance = 'bullish' | 'bearish' | 'neutral' | 'na';
export type IntelSourceType = 'broker_research' | 'media' | 'filing' | 'internal';
export type IntelOrigin = 'manual' | 'auto';

export interface MarketIntelRow {
  id: string;
  title: string;
  region: IntelRegion;
  stance: IntelStance;
  summary: string | null;
  source_type: IntelSourceType | null;
  source_name: string | null;
  source_url: string | null;
  source_origin: IntelOrigin;
  author: string | null;
  published_at: string | null;
  created_at: string;
}

export const getMarketIntel = cache(async (limit = 200): Promise<{ rows: MarketIntelRow[]; source: 'supabase' | 'empty' }> => {
  const supabase = await getAuthed();
  if (!supabase) return { rows: [], source: 'empty' };
  const { data, error } = await supabase
    .from('market_intel')
    .select('id, title, region, stance, summary, source_type, source_name, source_url, source_origin, author, published_at, created_at')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) return { rows: [], source: 'empty' };
  return { rows: (data ?? []) as MarketIntelRow[], source: 'supabase' };
});

// ============================================================
// 向後相容 getSnapshot — 拼接各 fetcher,讓尚未重構的 view 仍能跑
// ============================================================
export const getSnapshot = cache(async (): Promise<Snapshot> => {
  if (IS_DEMO) return fixtureSnapshot;
  const supabase = await getAuthed();
  if (!supabase) return fixtureSnapshot;

  const [deals, profilesTeams, tasks, tierConfig] = await Promise.all([
    getDealsLight(),
    getProfilesAndTeams(),
    getTasks(),
    getTierConfig(),
  ]);

  return {
    deals: deals as unknown as Deal[],
    profiles: profilesTeams.profiles,
    tasks,
    teams: profilesTeams.teams,
    tierConfig,
    source: 'supabase',
    fetchedAt: new Date().toISOString(),
  };
});
