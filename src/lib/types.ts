export type StageId = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L7';

export type Tier = 'SSS' | 'S' | 'A' | 'B' | 'C';

export interface TierConfigItem {
  key: Tier;
  name: string;
  aum_min: number;
  contact_days: number;
}

// 三層權限:RM 只看自己;Team Lead 看自己團隊;Admin 看全部
export type Role = 'rm' | 'team_lead' | 'admin';

export interface Team {
  id: string;
  name: string;
  created_at: string;
}

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

export interface ScoreNote {
  deal_id: string;
  field: keyof Scores;
  evidence: string;
  next_action: string;
}

export interface ChecklistItem {
  deal_id: string;
  item_key: string;
  checked: boolean;
  checked_at: string;
}

export interface Comment {
  id: string;
  deal_id: string;
  author_id: string | null;
  body: string;
  is_system: boolean;
  created_at: string;
}

export interface DealQuestion {
  deal_id: string;
  question_key: string;
  answered: boolean;
  note: string;
  asked_at: string;
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
  plan: DealPlan | null;
  created_at: string;
  scores?: Scores;
  score_notes?: ScoreNote[];
  stage_checklist?: ChecklistItem[];
  comments?: Comment[];
  deal_questions?: DealQuestion[];
  rm?: Profile | null;
}

export interface Settings {
  id: 1;
  stage_probs: Record<StageId, number>;
  red_flag: { ebScore: number; totalScore: number; staleDays: number };
  tier_config: { tiers: TierConfigItem[] };
}

// ====== AI Plan types ======
export interface PlanStep {
  id: string;
  title: string;
  target_date: string;
  stage_transition: string;
  focus: string[];
  talking_points: string[];
  risks: string[];
  completed: boolean;
  completed_at: string | null;
}

export interface DealPlan {
  target_date: string;
  generated_at: string;
  model: string;
  overview: string;
  feasibility: 'high' | 'medium' | 'low';
  feasibility_reason: string;
  top_risks: string[];
  steps: PlanStep[];
}

// Feature A — AI 解析互動的回應
export interface ParseInteractionSuggestion {
  summary: string;
  score_updates: Array<{ field: string; old: number; new: number; reason: string }>;
  new_comment: string;
  next_step_update: string | null;
  question_checkoffs: string[];
  stage_suggestion: StageId | null;
  ask_back: string[];
}
