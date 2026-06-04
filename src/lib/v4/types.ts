// V4 platform types — slim subset of ws_crm types, only what the two layouts render.

export type StageId = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L7';
export type Tier = 'SSS' | 'S' | 'A' | 'B' | 'C';
export type Role = 'rm' | 'team_lead' | 'admin';
export type TaskStatus = 'todo' | 'doing' | 'done';
export type TaskPriority = 'low' | 'normal' | 'high';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  rm_code: string | null;
  role: Role;
  team_id: string | null;
}

export interface Scores {
  m: number; e: number; d1: number; d2: number;
  p: number; i: number; c1: number; c2: number;
}

export interface Comment {
  id: string;
  deal_id: string;
  author_id: string | null;
  body: string;
  is_system: boolean;
  is_raw: boolean;
  raw_body?: string | null;   // AI 摘要對應的原話(migration_24);其他來源為 null
  created_at: string;
}

export type ScoreField = 'm' | 'e' | 'd1' | 'd2' | 'p' | 'i' | 'c1' | 'c2';

export interface ScoreNote {
  deal_id: string;
  field: ScoreField;
  note: string;
  updated_at?: string;
}

export interface PainPoint {
  id: string;
  pain: string;
  product: string;
  pitch: string;
  tiers: string;
  order_idx: number;
  is_active: boolean;
}

export interface ChecklistItem {
  deal_id: string;
  item_key: string;       // 例如 'l2_aum',包含 stage 前綴
  checked: boolean;
  checked_by?: string | null;
}

export interface DealQuestion {
  deal_id: string;
  question_key: string;
  answered: boolean;
  note: string;
  asked_at?: string;
}

export interface DealAttachment {
  id: string;
  deal_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string | null;
  comment_id?: string | null;
  created_at: string;
}

export interface DealPlanStep {
  id: string;
  title: string;
  target_date: string;
  stage_transition: string;
  focus: string[];
  talking_points: string[];
  risks: string[];
  completed?: boolean;
  completed_at?: string | null;
}

export interface DealPlan {
  target_date: string;
  generated_at: string;
  model: string;
  overview: string;
  feasibility: 'high' | 'medium' | 'low';
  feasibility_reason: string;
  top_risks: string[];
  steps: DealPlanStep[];
}

export interface Deal {
  id: string;
  name: string;
  rm_id: string;
  aum_usd: number;
  product: string | null;
  first_contact: string;
  last_updated: string;
  last_contact_at: string | null;
  tier: Tier | null;
  stage: StageId;
  next_step: string | null;
  target_close_date: string | null;
  created_at: string;
  plan?: DealPlan | null;
  scores?: Scores;
  score_notes?: ScoreNote[];
  stage_checklist?: ChecklistItem[];
  deal_questions?: DealQuestion[];
  deal_attachments?: DealAttachment[];
  comments?: Comment[];
  rm?: Profile | null;
}

export interface Task {
  id: string;
  deal_id: string | null;
  title: string;
  description: string;
  assignee_id: string | null;
  // 協作者(migration 27)。主責人之外、一起討論/開會的人;行事曆同步時
  // 與主責人一起設為事件與會者。DB 一律回陣列;型別選填以相容既有 fixtures。
  participant_ids?: string[];
  due_date: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  created_at: string;
  completed_at: string | null;
  // Google 行事曆同步(migration 26)。舊 row / 未同步者為 null。
  google_event_id?: string | null;
  google_event_owner?: string | null;
  google_synced_at?: string | null;
  google_sync_error?: string | null;
}

export interface Team {
  id: string;
  name: string;
}

export interface TierConfigItem {
  key: Tier;
  name: string;
  aum_min: number;
  contact_days: number;
}

export interface Snapshot {
  deals: Deal[];
  profiles: Profile[];
  tasks: Task[];
  teams: Team[];
  tierConfig: TierConfigItem[];
  source: 'supabase' | 'fixtures';
  fetchedAt: string;
}
