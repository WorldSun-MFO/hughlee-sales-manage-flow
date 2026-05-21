// ============================================================
// 全域型別定義 — 整個 codebase 的型別單一來源
// ============================================================
// 這個檔案不引入任何 runtime,只有 type / interface。
//
// 對應資料表(Postgres):
//   Profile         ←→ public.profiles
//   Team            ←→ public.teams
//   Deal            ←→ public.deals (含 join scores / score_notes / stage_checklist
//                      / deal_questions / deal_attachments / comments / rm)
//   Scores          ←→ public.scores (1:1 with deals)
//   ScoreNote       ←→ public.score_notes
//   ChecklistItem   ←→ public.stage_checklist
//   Comment         ←→ public.comments
//   DealQuestion    ←→ public.deal_questions
//   PainPoint       ←→ public.pain_points
//   Task            ←→ public.tasks
//   DealAttachment  ←→ public.deal_attachments (對應 Storage bucket: deal-attachments)
//   Settings        ←→ public.settings (singleton id=1)
//   MarketIntel 等   ←→ public.market_intel + 周邊(市場情報模組,Phase 1-5)
//
// 使用慣例:
//   - Supabase 回傳型別常與這裡不完全相符(陣列 vs 物件、null 處理),
//     在 caller 端用 `as unknown as Deal[]` 收斂,勿散落 `any`。
//   - 加新欄位時:① 改這裡 ② 改 migration SQL ③ 同步 docs/SECURITY.md 附錄 A
// ============================================================

// ---------- 漏斗階段 ----------
// L1: 線索 / 初接觸 → L2 MQL → L3 SQL → L4 提案 → L5 談判 → L6 核保 → L7 成交
// Playbook 已定義但實作未做的 L0(Source)/ L8(Expand)目前不在型別內
export type StageId = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L7';

// ---------- 客戶等級 ----------
// 依 AUM 自動分級(constants.ts:DEFAULT_TIER_CONFIG),也可在 DealDetail 手動覆寫
export type Tier = 'SSS' | 'S' | 'A' | 'B' | 'C';

export interface TierConfigItem {
  key: Tier;
  name: string;
  aum_min: number;       // 最低 AUM 門檻(USD)
  contact_days: number;  // 建議聯繫週期(天);超過會在「今日追蹤清單」標逾期
}

// ---------- 角色三層 ----------
// rm: 只看自己的 deals
// team_lead: 看同團隊 RM 的 deals(透過 profiles.team_id 比對)
// admin: 看全部 + 改設定 + 停用使用者
// 權限在 DB 端強制,見 migration_8_teams.sql 的 can_access_deal() helper
export type Role = 'rm' | 'team_lead' | 'admin';

// ---------- 檔案附件(Sprint C,migration_11) ----------
// 對應 Supabase Storage bucket: deal-attachments
// 路徑慣例: {deal_id}/{uuid}.{ext}
// 50MB 上限(前端檢查,Storage policies 也限制)
export interface DealAttachment {
  id: string;
  deal_id: string;
  storage_path: string;   // bucket 內的相對路徑,取 signed URL 用
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string | null;
  comment_id: string | null;  // 若是從某筆 comment 上傳的(目前未強制)
  created_at: string;
}

// ---------- 任務追蹤(Sprint B,migration_10) ----------
export type TaskStatus = 'todo' | 'doing' | 'done';
export type TaskPriority = 'low' | 'normal' | 'high';

// 任務來源:
// - manual:RM 在 TasksTab 直接建立
// - deal_next_step:從 DealDetail 的「下一步」一鍵升級(splitNextStepIntoTasks)
// - ai_plan_step:從 PlanModal 產出的 plan.steps[].focus 升級
export type TaskSourceType = 'manual' | 'deal_next_step' | 'ai_plan_step';

export interface Task {
  id: string;
  deal_id: string | null;       // null = 獨立任務,不綁案件
  title: string;
  description: string;
  assignee_id: string | null;
  due_date: string | null;      // YYYY-MM-DD
  status: TaskStatus;
  priority: TaskPriority;
  source_type: TaskSourceType;
  source_ref: string;           // 例如 plan step id,debug 用
  created_by: string | null;
  created_at: string;
  completed_at: string | null;  // trigger 自動填(migration_10 末段)
}

// ---------- 團隊(migration_8) ----------
// 業務組(WS Team / Daniel Team / Eason Team),admin 在 SettingsModal 維護
export interface Team {
  id: string;
  name: string;
  created_at: string;
}

// ---------- 使用者(profiles 擴展 auth.users) ----------
// id 主鍵 = auth.users.id,DB trigger handle_new_user 自動建檔(migration_19)
export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  rm_code: string | null;       // 顯示用代號,可空
  role: Role;
  team_id: string | null;       // null = 未分團隊
}

// ---------- MEDDIC 分數(scores 表,1:1 與 deals) ----------
// 每個字母 0-10,deals 建立時 trigger 自動初始化全 0 (schema.sql:init_scores)
// 總分 80 = sum 所有字母
// 注意:目前是 MEDDIC(7 字母),Playbook 已升級 MEDDPICC 多了 P(Paper Process)
//      schema 已加 p 欄位,但 UI checklist 還未完整對應(CLAUDE.md backlog)
export interface Scores {
  m: number; e: number; d1: number; d2: number;
  p: number; i: number; c1: number; c2: number;
}

// 每個字母的證據 + 下一步筆記(score_notes 表,複合主鍵 deal_id + field)
export interface ScoreNote {
  deal_id: string;
  field: keyof Scores;
  evidence: string;
  next_action: string;
}

// 階段推進 checklist 的勾選狀態(stage_checklist 表)
// item_key 對應 constants.ts:CHECKLIST 裡的穩定 key(如 'l2_aum')
export interface ChecklistItem {
  deal_id: string;
  item_key: string;
  checked: boolean;
  checked_at: string;
}

// 註解時間軸的單筆紀錄(comments 表)
// is_system:系統自動產生(階段推進、AI 套用後寫入)
// is_raw   :使用者在 AI 助手貼入的原始對話,保留不被 AI 改寫的 audit trail
export interface Comment {
  id: string;
  deal_id: string;
  author_id: string | null;
  body: string;
  is_system: boolean;
  is_raw: boolean;          // 原始對話 / 語音逐字稿(未經 AI 處理)
  created_at: string;
}

// 實戰題庫的「已釐清」狀態(deal_questions 表,migration_3)
// question_key 對應 constants.ts:QUESTION_BANK 的穩定 key(如 'm_aum'),
// 題目改寫不會影響歷史(DB 只存 key)
export interface DealQuestion {
  deal_id: string;
  question_key: string;
  answered: boolean;
  note: string;
  asked_at: string;
}

// 痛點 → 商品對應(pain_points 表,migration_3)
// admin 在 SettingsModal 維護,Dashboard / DealDetail 顯示
export interface PainPoint {
  id: string;
  pain: string;
  product: string;
  pitch: string;            // 一句話 pitch
  tiers: string;            // 逗號分隔,適用層級(如 'SSS,S')
  order_idx: number;        // 排序;新增時自動取 max+10 讓中間可插
  is_active: boolean;
}

// ---------- 案件本體 ----------
// 整個系統的中心物件。Dashboard initialDeals 用一個大 join 一次抓齊(見 page.tsx)
export interface Deal {
  id: string;
  name: string;
  rm_id: string;
  aum_usd: number;          // 注意:DB 是 numeric,前端常需要 Number() 收斂
  product: string | null;
  first_contact: string;    // YYYY-MM-DD
  last_updated: string;     // ISO timestamp,所有寫入動作都會更新
  last_contact_at: string | null;
  tier: Tier | null;
  stage: StageId;
  next_step: string | null; // 純文字 textarea,可多行(splitNextStepIntoTasks 拆解)
  target_close_date: string | null;
  plan: DealPlan | null;    // AI 產出的成交路徑,整包 JSONB 存
  created_at: string;
  // 以下為 SELECT 時 join 進來的關聯(非欄位本身)
  scores?: Scores;
  score_notes?: ScoreNote[];
  stage_checklist?: ChecklistItem[];
  comments?: Comment[];
  deal_questions?: DealQuestion[];
  deal_attachments?: DealAttachment[];
  rm?: Profile | null;
}

// ---------- 全站設定(settings 表,singleton id=1) ----------
// 只有 admin 能改(RLS 限制),客戶端 / 戰報 cron 都讀這份
export interface Settings {
  id: 1;
  stage_probs: Record<StageId, number>;        // 加權預測用的階段機率(%)
  red_flag: {
    ebScore: number;                            // E 分數低於此值 → 紅旗(預設 4)
    totalScore: number;                         // 總分低於此值 → 紅旗(預設 40)
    staleDays: number;                          // 多久沒更新 → 紅旗(預設 30)
    contactWarnDays?: number;                   // 多久沒聯繫 → 警示(預設 14,Sprint A 加入)
  };
  tier_config: { tiers: TierConfigItem[] };    // 客戶等級配置
}

// ====== AI Plan types ======
// PlanModal + /api/ai/generate-plan 的契約;整包存進 deals.plan(JSONB)
export interface PlanStep {
  id: string;
  title: string;
  target_date: string;       // YYYY-MM-DD
  stage_transition: string;  // 例如 'L3→L4'
  focus: string[];           // 核心動作(可逐項升級為任務)
  talking_points: string[];  // 建議話術(僅參考,不可升級任務)
  risks: string[];           // 風險(僅參考)
  completed: boolean;
  completed_at: string | null;
}

export interface DealPlan {
  target_date: string;
  generated_at: string;      // ISO,AI 產出時間
  model: string;             // 例如 'claude-opus-4-7',用於追溯
  overview: string;
  feasibility: 'high' | 'medium' | 'low';
  feasibility_reason: string;
  top_risks: string[];
  steps: PlanStep[];
}

// ====== 金融資訊大腦 / Market Intel(Phase 1)======
// 本模組獨立於主 CRM,在 /market 路徑下;主 CRM 只有 DealDetail 的
// ClientAmmoCard 會用到它(透過 /api/ai/client-talking-points)
export type IntelSourceType = 'broker_research' | 'media' | 'filing' | 'internal';
export type IntelRegion = 'TW' | 'US' | 'JP' | 'CN' | 'GLOBAL';
export type IntelStance = 'bullish' | 'bearish' | 'neutral' | 'na';
export type TagCategory = 'region' | 'industry' | 'ticker' | 'macro' | 'theme';

export interface MarketTag {
  id: string;
  name: string;
  category: TagCategory;
  created_at?: string;
}

// 情報 ↔ 客戶關聯(Phase 2)
export interface IntelDealLink {
  deal_id: string;
  relevance_reason: string;
  deal?: { id: string; name: string } | null;   // join 進來方便顯示
}

// 配對建議待審(Phase 5.2:自動進件 AI 配對 → RM 審核)
export interface IntelLinkSuggestion {
  id: string;
  intel_id: string;
  deal_id: string;
  relevance_reason: string;
  status: 'pending' | 'accepted' | 'dismissed';
  created_at: string;
  intel?: {
    id: string;
    title: string;
    summary: string;
    stance: IntelStance;
    region: IntelRegion;
    source_name: string;
  } | null;
}

// 精簡客戶(餵 AI / 關聯選單用)
export interface DealLite {
  id: string;
  name: string;
  product: string | null;
  stage: string;
}

// AI 解析後回填表單用的草稿(Phase 2)
export interface MarketParseDraft {
  title: string;
  region: IntelRegion;
  stance: IntelStance;
  summary: string;
  key_points: string[];
  source_name: string;
  author: string;
  source_url?: string;     // 由網址解析時帶回原網址
  tags: { category: TagCategory; name: string }[];
  suggested_deal_links: { deal_id: string; relevance_reason: string }[];
}

export interface MarketIntel {
  id: string;
  title: string;
  source_type: IntelSourceType;
  source_name: string;
  source_url: string;
  region: IntelRegion;
  summary: string;
  key_points: string[];
  stance: IntelStance;
  author: string;
  published_at: string | null;
  source_origin: 'manual' | 'auto';   // 人工建檔 vs 自動抓取(Phase 5)
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // 關聯(查詢時 join 進來)
  tags?: MarketTag[];
  deal_links?: IntelDealLink[];
  creator?: { full_name: string | null } | null;
}

// 自動抓取來源(ingest_sources;Phase 5.2-d 來源管理)
export interface IngestSource {
  id: string;
  name: string;
  kind: 'rss' | 'api';
  url: string;
  region: IntelRegion | null;
  active: boolean;
  last_run_at: string | null;
  last_status: string;
  created_at: string;
  provider?: string | null;        // API 來源:供應商代號(如 'newsdata');RSS 為 null
  skip_keyword_gate?: boolean;     // true = 跳過中/英文關鍵字相關性閘門
}

// ====== AI 解析互動 ======
// AIChatModal 與 /api/ai/parse-interaction 的回傳契約
// schema 在 lib/anthropic/schemas.ts 的 PARSE_INTERACTION_JSON_SCHEMA
export interface ParseInteractionSuggestion {
  summary: string;                  // 一句話總結
  score_updates: Array<{ field: string; old: number; new: number; reason: string }>;
  new_comment: string;              // 要寫到時間軸的摘要(非 raw)
  next_step_update: string | null;  // 多行用 \n 分隔,讓 splitNextStepIntoTasks 拆任務
  question_checkoffs: string[];     // 對應 QUESTION_BANK 的 key(如 'm_aum')
  stage_suggestion: StageId | null;
  ask_back: string[];               // AI 建議下次追問,僅參考,不套用
}
