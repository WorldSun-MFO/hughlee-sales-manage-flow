export type StageId = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L7';
export type Tier = 'SSS' | 'S' | 'A' | 'B' | 'C';
export type Role = 'rm' | 'team_lead' | 'admin';

export interface TierConfigItem {
  key: Tier;
  name: string;
  aum_min: number;
  contact_days: number;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  rm_code: string | null;
  role: Role;
  team_id: string | null;
}

export interface Team {
  id: string;
  name: string;
  created_at: string;
}

export interface Scores {
  m: number;
  e: number;
  d1: number;
  d2: number;
  p: number;
  i: number;
  c1: number;
  c2: number;
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
  is_raw: boolean;
  created_at: string;
}

export interface DealQuestion {
  deal_id: string;
  question_key: string;
  answered: boolean;
  note: string;
  asked_at: string;
}

export interface DealAttachment {
  id: string;
  deal_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string | null;
  comment_id: string | null;
  created_at: string;
}

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
  deal_attachments?: DealAttachment[];
  rm?: Profile | null;
}

export type TaskStatus = 'todo' | 'doing' | 'done';
export type TaskPriority = 'low' | 'normal' | 'high';
export type TaskSourceType = 'manual' | 'deal_next_step' | 'ai_plan_step';

export interface Task {
  id: string;
  deal_id: string | null;
  title: string;
  description: string;
  assignee_id: string | null;
  due_date: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  source_type: TaskSourceType;
  source_ref: string;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
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

export type IntelRegion = 'TW' | 'US' | 'JP' | 'CN' | 'GLOBAL';
export type IntelStance = 'bullish' | 'bearish' | 'neutral' | 'na';
export type TagCategory = 'region' | 'industry' | 'ticker' | 'macro' | 'theme';

export interface MarketTag {
  id: string;
  name: string;
  category: TagCategory;
}

export interface IntelDealLink {
  deal_id: string;
  relevance_reason: string;
  deal?: { id: string; name: string } | null;
}

export interface MarketIntel {
  id: string;
  title: string;
  source_type: 'broker_research' | 'media' | 'filing' | 'internal';
  source_name: string;
  source_url: string;
  region: IntelRegion;
  summary: string;
  key_points: string[];
  stance: IntelStance;
  author: string;
  published_at: string | null;
  source_origin: 'manual' | 'auto';
  created_by: string | null;
  created_at: string;
  updated_at: string;
  tags?: MarketTag[];
  deal_links?: IntelDealLink[];
  creator?: { full_name: string | null } | null;
}

export interface Settings {
  id: 1;
  stage_probs: Record<StageId, number>;
  red_flag: {
    ebScore: number;
    totalScore: number;
    staleDays: number;
    contactWarnDays?: number;
  };
  tier_config: { tiers: TierConfigItem[] };
}

export const DEFAULT_TIER_CONFIG: TierConfigItem[] = [
  { key: 'SSS', name: '旗艦 Flagship', aum_min: 80_000_000, contact_days: 14 },
  { key: 'S', name: '高階 Premier', aum_min: 50_000_000, contact_days: 30 },
  { key: 'A', name: '中階 Advanced', aum_min: 10_000_000, contact_days: 30 },
  { key: 'B', name: '初階 Entry', aum_min: 5_000_000, contact_days: 60 },
  { key: 'C', name: '基礎 Foundation', aum_min: 1_000_000, contact_days: 90 },
];

export const STAGES: Array<{ id: StageId; name: string; targetConv: string }> = [
  { id: 'L1', name: '線索 / 初接觸', targetConv: '50~60%' },
  { id: 'L2', name: '資格初判 (MQL)', targetConv: '60~70%' },
  { id: 'L3', name: '需求探詢 (SQL)', targetConv: '40~50%' },
  { id: 'L4', name: '方案設計 (Proposal)', targetConv: '60~70%' },
  { id: 'L5', name: '談判 / 異議處理', targetConv: '70~80%' },
  { id: 'L6', name: '核保 / 融資', targetConv: '85~95%' },
  { id: 'L7', name: '客戶 / 加碼 (Won)', targetConv: '-' },
];

export const MEDDIC: Array<{ key: keyof Scores; label: string; hint: string }> = [
  { key: 'm', label: 'M — Metrics', hint: '量化指標、現金流需求、報酬目標與時間軸。' },
  { key: 'e', label: 'E — Economic Buyer', hint: '真正能拍板的人是否已確認並參與。' },
  { key: 'd1', label: 'D1 — Decision Criteria', hint: '客戶前三大決策標準是否排序。' },
  { key: 'd2', label: 'D2 — Decision Process', hint: '從認同到簽署的路徑、時程與關卡。' },
  { key: 'p', label: 'P — Paper Process', hint: '資產證明、開戶、公司戶文件、核保文件。' },
  { key: 'i', label: 'I — Identify Pain', hint: '情感痛點是否具體，不只是商品需求。' },
  { key: 'c1', label: 'C1 — Champion', hint: '內部倡議者是否會在我們不在場時推進。' },
  { key: 'c2', label: 'C2 — Competition', hint: '競爭方案、既有私銀與顧問阻力。' },
];

export function fmtMoney(n: number | null | undefined): string {
  if (!n) return '$0';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
  return '$' + n;
}

export function totalScore(deal: Deal): number {
  const s = deal.scores;
  if (!s) return 0;
  return s.m + s.e + s.d1 + s.d2 + s.p + s.i + s.c1 + s.c2;
}

export function daysSince(dateStr: string | null | undefined): number {
  if (!dateStr) return 0;
  const diff = (Date.now() - new Date(dateStr).getTime()) / 86400000;
  return Math.max(0, Math.floor(diff));
}

export function redFlag(deal: Deal, settings: Settings): string | null {
  const { ebScore, totalScore: minTotal, staleDays } = settings.red_flag;
  if ((deal.scores?.e ?? 0) < ebScore) return 'EB 未確認';
  if (totalScore(deal) < minTotal) return '總分過低';
  if (daysSince(deal.last_updated) > staleDays) return `${staleDays}+ 天未更新`;
  return null;
}

export function stageIdx(stageId: StageId): number {
  return STAGES.findIndex(s => s.id === stageId);
}

export function contactDaysSince(deal: Deal): number | null {
  if (!deal.last_contact_at) return null;
  return Math.floor((Date.now() - new Date(deal.last_contact_at).getTime()) / 86400000);
}

export function contactOverdue(deal: Deal, tiers: TierConfigItem[]): { status: 'ok' | 'due_soon' | 'overdue'; daysSince: number; interval: number; deltaDays: number } | null {
  if (!deal.tier || !deal.last_contact_at) return null;
  const tierCfg = tiers.find(t => t.key === deal.tier);
  if (!tierCfg) return null;
  const days = contactDaysSince(deal) ?? 0;
  const deltaDays = days - tierCfg.contact_days;
  const status = deltaDays > 0 ? 'overdue' : deltaDays >= -3 ? 'due_soon' : 'ok';
  return { status, daysSince: days, interval: tierCfg.contact_days, deltaDays };
}

export function priorityReason(deal: Deal, settings: Settings, tiers: TierConfigItem[]) {
  if (deal.stage === 'L7') return null;
  const flag = redFlag(deal, settings);
  if (flag) return { icon: 'red-flag', text: flag, weight: 1000 };
  const ci = contactOverdue(deal, tiers);
  if (ci?.status === 'overdue') return { icon: 'contact', text: `已逾期 ${ci.deltaDays} 天未聯繫(${deal.tier ?? '?'} 等級週期)`, weight: 500 + ci.deltaDays * 5 };
  const warnDays = settings.red_flag.contactWarnDays ?? 14;
  if (deal.last_contact_at) {
    const days = contactDaysSince(deal) ?? 0;
    if (days >= warnDays) return { icon: 'contact', text: `已 ${days} 天未聯繫(超過 ${warnDays} 天警戒)`, weight: 350 + days };
  }
  const staleDays = daysSince(deal.last_updated);
  if (['L4', 'L5', 'L6'].includes(deal.stage) && staleDays > 14) return { icon: 'stale', text: `${deal.stage} 卡 ${staleDays} 天沒動`, weight: 200 + staleDays };
  if (ci?.status === 'due_soon') return { icon: 'contact', text: `${Math.abs(ci.deltaDays)} 天內需聯繫`, weight: 100 };
  return null;
}

export function urgencyScore(deal: Deal, settings: Settings, tiers: TierConfigItem[]): number {
  const reason = priorityReason(deal, settings, tiers);
  if (!reason) return 0;
  const tierWeight: Record<string, number> = { SSS: 50, S: 30, A: 20, B: 10, C: 5 };
  return reason.weight + (tierWeight[deal.tier ?? ''] ?? 0);
}

const ENUM_MARK =
  '(?:\\d{1,2}\\.(?!\\d)|\\d{1,2}[、)）．:：]|[（(]\\d{1,2}[)）]|[①②③④⑤⑥⑦⑧⑨⑩]|[一二三四五六七八九十]{1,2}、)';

export function splitNextStepIntoTasks(raw: string | null | undefined): string[] {
  if (!raw || !raw.trim()) return [];
  let s = raw.replace(/\r\n?/g, '\n');
  s = s.replace(new RegExp(`([\\s、,;；。．])(?=${ENUM_MARK}\\s*\\S)`, 'g'), '$1\n');
  s = s.replace(/(?!^)(?=[②③④⑤⑥⑦⑧⑨⑩])/g, '\n');
  return s
    .split('\n')
    .map(l =>
      l
        .trim()
        .replace(
          /^(?:\d{1,2}\.(?!\d)|\d{1,2}[、)）．:：]|[（(]\d{1,2}[)）]|[A-Za-z][.)、]|[①②③④⑤⑥⑦⑧⑨⑩]|[（(]?[一二三四五六七八九十]{1,2}[)）]?、|[-•*‧·–—])\s*/,
          ''
        )
        .trim()
    )
    .filter(l => l.length > 0);
}
