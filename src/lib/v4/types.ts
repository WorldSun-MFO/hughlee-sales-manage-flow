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
  created_at: string;
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
  scores?: Scores;
  comments?: Comment[];
  rm?: Profile | null;
}

export interface Task {
  id: string;
  deal_id: string | null;
  title: string;
  description: string;
  assignee_id: string | null;
  due_date: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  created_at: string;
  completed_at: string | null;
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
