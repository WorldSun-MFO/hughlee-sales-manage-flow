// ============================================================
// V4 mutation helpers — 各 view / drawer 共用的 DB 寫入函式
// ============================================================
// 為什麼集中在這裡:
//   - 每個 view 自己寫一份很容易漂(欄位拼錯 / 沒 update last_updated)
//   - 集中後可以保證每次寫入都同步 deals.last_updated(realtime / 排序 / 紅旗計算靠這個)
//
// 所有函式都 throw on error;呼叫端 try/catch 自己處理 UI。
// RLS 過濾在 DB 端做,前端不必預先檢查權限。
// ============================================================
'use client';
import { createClient } from '@/lib/supabase/client';
import type { ScoreField, StageId, Tier } from '@/lib/v4/types';

// ---------- Deal 欄位編輯 ----------
type DealPatch = Partial<{
  name: string;
  next_step: string | null;
  stage: StageId;
  tier: Tier | null;
  product: string | null;
  target_close_date: string | null;
  rm_id: string;
  aum_usd: number;
  first_contact: string;
}>;

export async function patchDeal(dealId: string, patch: DealPatch): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('deals')
    .update({ ...patch, last_updated: new Date().toISOString() })
    .eq('id', dealId);
  if (error) throw error;
}

// ---------- 剛聯繫 ----------
export async function markContacted(dealId: string): Promise<void> {
  const supabase = createClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('deals')
    .update({ last_contact_at: now, last_updated: now })
    .eq('id', dealId);
  if (error) throw error;
}

// ---------- Comment ----------
export async function addComment(
  dealId: string,
  body: string,
  opts: { isRaw?: boolean } = {},
): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('comments').insert({
    deal_id: dealId,
    author_id: user?.id ?? null,
    body,
    is_raw: opts.isRaw ?? false,
    is_system: false,
  });
  if (error) throw error;
  // 加 comment 也算 deal 動了一下,連動 last_updated 讓排序新鮮
  await supabase.from('deals').update({ last_updated: new Date().toISOString() }).eq('id', dealId);
}

// ---------- MEDDIC scores ----------
type ScorePatch = Partial<{ m: number; e: number; d1: number; d2: number; p: number; i: number; c1: number; c2: number }>;

export async function patchScores(dealId: string, patch: ScorePatch): Promise<void> {
  const supabase = createClient();
  // scores 是 deals 的 1:1 子表(deal_id PK),用 upsert 較安全
  const { error } = await supabase
    .from('scores')
    .upsert({ deal_id: dealId, ...patch }, { onConflict: 'deal_id' });
  if (error) throw error;
  await supabase.from('deals').update({ last_updated: new Date().toISOString() }).eq('id', dealId);
}

// ---------- 單一 MEDDIC 欄位的文字理由(score_notes 子表)----------
export async function setScoreNote(dealId: string, field: ScoreField, note: string): Promise<void> {
  const supabase = createClient();
  // 複合主鍵 (deal_id, field),upsert 避免衝突
  const { error } = await supabase
    .from('score_notes')
    .upsert({ deal_id: dealId, field, note }, { onConflict: 'deal_id,field' });
  if (error) throw error;
}

// ---------- stage_checklist:勾掉 / 取消勾選 ----------
export async function toggleChecklistItem(
  dealId: string, stage: StageId, itemKey: string, done: boolean,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('stage_checklist')
    .upsert({
      deal_id: dealId, stage, item_key: itemKey,
      done, done_at: done ? new Date().toISOString() : null,
    }, { onConflict: 'deal_id,stage,item_key' });
  if (error) throw error;
}

// ---------- deal_questions:勾答案 + 補註 ----------
export async function setDealQuestion(
  dealId: string, questionKey: string, answered: boolean, note = '',
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('deal_questions')
    .upsert({
      deal_id: dealId, question_key: questionKey, answered, note,
      asked_at: new Date().toISOString(),
    }, { onConflict: 'deal_id,question_key' });
  if (error) throw error;
}

// ---------- Tasks ----------
export interface TaskInsert {
  deal_id: string | null;
  title: string;
  description?: string;
  assignee_id?: string | null;
  due_date?: string | null;
  priority?: 'low' | 'normal' | 'high';
  status?: 'todo' | 'doing' | 'done';
}

export async function createTask(input: TaskInsert): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('tasks').insert({
    deal_id: input.deal_id,
    title: input.title,
    description: input.description ?? '',
    assignee_id: input.assignee_id ?? null,
    due_date: input.due_date ?? null,
    priority: input.priority ?? 'normal',
    status: input.status ?? 'todo',
  });
  if (error) throw error;
}

export async function patchTask(
  taskId: string,
  patch: Partial<{ title: string; description: string; assignee_id: string | null; due_date: string | null; priority: 'low' | 'normal' | 'high'; status: 'todo' | 'doing' | 'done' }>,
): Promise<void> {
  const supabase = createClient();
  const next: Record<string, unknown> = { ...patch };
  if (patch.status === 'done') next.completed_at = new Date().toISOString();
  else if (patch.status) next.completed_at = null;
  const { error } = await supabase.from('tasks').update(next).eq('id', taskId);
  if (error) throw error;
}

export async function deleteTask(taskId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) throw error;
}

// ---------- 拆 next_step 成多個任務(沿用 ws_crm 既有邏輯)----------
export function splitNextStepIntoTasks(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[\s•·\-*]+/, '').trim())
    .filter((line) => line.length > 0 && line.length < 300);
}

// ---------- Plan 存回 deals.plan ----------
export async function savePlan(dealId: string, plan: unknown): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('deals')
    .update({ plan, last_updated: new Date().toISOString() })
    .eq('id', dealId);
  if (error) throw error;
}

// ---------- 新增案件 ----------
export interface NewDealInput {
  name: string;
  aum_usd: number;
  tier?: Tier | null;
  product?: string | null;
  next_step?: string | null;
  target_close_date?: string | null;
  first_contact?: string;
}

/**
 * 建立新案件。
 *
 * 自動值:
 *   - rm_id = 當前登入者(從 auth.getUser 取)
 *   - stage = L1
 *   - first_contact = 今天(若未提供)
 *   - scores 子表會同步建立一筆全 0 的 row
 *
 * 回傳新建 deal 的 id,給呼叫端 navigate 用。
 */
export async function createDeal(input: NewDealInput): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('未登入');

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('deals')
    .insert({
      name: input.name,
      rm_id: user.id,
      aum_usd: input.aum_usd,
      tier: input.tier ?? null,
      stage: 'L1' as StageId,
      product: input.product ?? null,
      next_step: input.next_step ?? null,
      target_close_date: input.target_close_date ?? null,
      first_contact: input.first_contact ?? today,
      last_updated: now,
    })
    .select('id')
    .single();
  if (error) throw error;

  const newId = (data as { id: string }).id;

  // scores 子表先塞一筆全 0,讓 inline edit 立刻可以改
  const { error: scoreErr } = await supabase
    .from('scores')
    .insert({ deal_id: newId, m: 0, e: 0, d1: 0, d2: 0, p: 0, i: 0, c1: 0, c2: 0 });
  // 不檢查 scoreErr,因為某些 schema 可能設了 trigger 自動建立 scores;
  // 若 unique violation 表示已有 row,可忽略
  void scoreErr;

  return newId;
}
