export type StageId = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L7';

export type Tier = 'SSS' | 'S' | 'A' | 'C';

export interface TierConfigItem {
  key: Tier;
  name: string;
  aum_min: number;
  contact_days: number;
}

export type Role = 'rm' | 'manager';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  rm_code: string | null;
  role: Role;
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
