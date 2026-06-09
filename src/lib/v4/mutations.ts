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
  opts: { isRaw?: boolean; rawBody?: string | null } = {},
): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('comments').insert({
    deal_id: dealId,
    author_id: user?.id ?? null,
    body,
    is_raw: opts.isRaw ?? false,
    raw_body: opts.rawBody ?? null,   // AI 摘要把對應原話存在同一筆(migration_24)
    is_system: false,
  });
  if (error) throw error;
  // 加 comment 也算 deal 動了一下,連動 last_updated 讓排序新鮮
  await supabase.from('deals').update({ last_updated: new Date().toISOString() }).eq('id', dealId);
}

// 刪除單筆 comment(活動紀錄)。RLS:comments_delete(rm 或 manager,見 migration_23)。
// comments 有 audit trigger,刪除會進 audit_log,admin 可還原。
export async function deleteComment(commentId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('comments').delete().eq('id', commentId);
  if (error) throw error;
}

// 編輯單筆 comment 內文(活動紀錄)。RLS:comments_update(rm 或 manager,見 migration_25)。
// 只動 body,raw_body / is_raw 等不變。
export async function patchComment(commentId: string, body: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('comments').update({ body }).eq('id', commentId);
  if (error) throw error;
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
// 沿用 ws_crm Dashboard 既有寫法:checked 為 false 時直接刪除 row,
// checked 為 true 時 upsert
export async function toggleChecklistItem(
  dealId: string, itemKey: string, checked: boolean,
): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!checked) {
    const { error } = await supabase
      .from('stage_checklist')
      .delete()
      .eq('deal_id', dealId)
      .eq('item_key', itemKey);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('stage_checklist')
      .upsert({ deal_id: dealId, item_key: itemKey, checked: true, checked_by: user?.id ?? null });
    if (error) throw error;
  }
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
  participant_ids?: string[];
  due_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  priority?: 'low' | 'normal' | 'high';
  status?: 'todo' | 'doing' | 'done';
}

// 任務變動後,非阻塞地請後端把它同步到 Google 行事曆。
// fire-and-forget:吞掉所有錯誤 —— 同步是附屬功能,絕不能擋住任務操作本身。
// (後端在 GCP / env 未設定時會安靜跳過;邏輯全在 /api/calendar/sync-task。)
function syncCalendar(
  payload:
    | { op: 'upsert'; taskId: string }
    | { op: 'delete'; googleEventId: string | null; googleEventOwner: string | null },
): void {
  void fetch('/api/calendar/sync-task', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true, // 即使使用者馬上關頁也盡量把請求送出去
  }).catch(() => {});
}

// 改回傳真實 task id,讓 TaskComposer 把 tmp id 換成 DB 真 id
// 後續點完成 / 改優先級 / 刪除才打得中資料
export async function createTask(input: TaskInsert): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.from('tasks').insert({
    deal_id: input.deal_id,
    title: input.title,
    description: input.description ?? '',
    assignee_id: input.assignee_id ?? null,
    participant_ids: input.participant_ids ?? [],
    due_date: input.due_date ?? null,
    start_time: input.start_time ?? null,
    end_time: input.end_time ?? null,
    priority: input.priority ?? 'normal',
    status: input.status ?? 'todo',
  }).select('id').single();
  if (error) throw error;
  const id = (data as { id: string }).id;
  syncCalendar({ op: 'upsert', taskId: id }); // 有 due_date 才會真的建事件,後端自己判斷
  return id;
}

export async function patchTask(
  taskId: string,
  patch: Partial<{ title: string; description: string; assignee_id: string | null; participant_ids: string[]; due_date: string | null; start_time: string | null; end_time: string | null; priority: 'low' | 'normal' | 'high'; status: 'todo' | 'doing' | 'done' }>,
): Promise<void> {
  const supabase = createClient();
  const next: Record<string, unknown> = { ...patch };
  if (patch.status === 'done') next.completed_at = new Date().toISOString();
  else if (patch.status) next.completed_at = null;
  const { error } = await supabase.from('tasks').update(next).eq('id', taskId);
  if (error) throw error;
  // 後端讀任務最新狀態自行決定:建立 / 修改 / (done 或無 due_date 則)移除事件
  syncCalendar({ op: 'upsert', taskId });
}

export async function deleteTask(taskId: string): Promise<void> {
  const supabase = createClient();
  // 刪 row 前先抓 Google 事件資訊 —— row 沒了就讀不到,後端也無從反查
  const { data: row } = await supabase
    .from('tasks')
    .select('google_event_id, google_event_owner')
    .eq('id', taskId)
    .maybeSingle();
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) throw error;
  const g = row as { google_event_id: string | null; google_event_owner: string | null } | null;
  if (g?.google_event_id) {
    syncCalendar({ op: 'delete', googleEventId: g.google_event_id, googleEventOwner: g.google_event_owner });
  }
}

// ---------- 拆 next_step 成多個任務(沿用 ws_crm 既有邏輯)----------
export function splitNextStepIntoTasks(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[\s•·\-*]+/, '').trim())
    .filter((line) => line.length > 0 && line.length < 300);
}

// ---------- Plan 存回 deals.plan ----------
// 對齊原 Dashboard.savePlan:
//   1. update deals.plan (JSONB)
//   2. update deals.target_close_date(讓 deal 的目標成交日跟 plan 同步)
//   3. update deals.last_updated
//   4. insert system comment 到時間軸(讓 review 看得到 plan 何時生成、可行性)
export async function savePlan(
  dealId: string,
  plan: import('./types').DealPlan,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('deals').update({
    plan,
    target_close_date: plan.target_date,
    last_updated: new Date().toISOString(),
  }).eq('id', dealId);
  if (error) throw error;

  // 順手寫一筆系統 comment 紀錄
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('comments').insert({
    deal_id: dealId,
    author_id: user?.id ?? null,
    body: `🎯 AI 產生成交路徑(目標 ${plan.target_date},可行性 ${plan.feasibility})`,
    is_system: true,
    is_raw: false,
  });
}

// ============================================================
// Admin / Settings 區
// ============================================================

// ---------- App settings(stage_probs / red_flag / tier_config)----------
export interface SettingsPatch {
  stage_probs?: Record<StageId, number>;
  red_flag?: { ebScore?: number; totalScore?: number; staleDays?: number; contactWarnDays?: number };
  tier_config?: { tiers: import('./types').TierConfigItem[] };
}

export async function updateSettings(patch: SettingsPatch): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('settings').update(patch).eq('id', 1);
  if (error) throw error;
}

// ---------- Teams ----------
export async function createTeam(name: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('teams').insert({ name });
  if (error) throw error;
}

export async function renameTeam(id: string, name: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('teams').update({ name }).eq('id', id);
  if (error) throw error;
}

export async function deleteTeam(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('teams').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Profile(成員)----------
export async function patchProfile(
  id: string,
  patch: Partial<{ full_name: string; role: import('./types').Role; team_id: string | null; rm_code: string | null }>,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('profiles').update(patch).eq('id', id);
  if (error) throw error;
}

// ---------- 成員停用 / 復原(admin only;走 RPC,SQL function 端再次驗權)----------
export async function banMember(email: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('admin_ban_user', { p_email: email });
  if (error) throw error;
}

export async function unbanMember(email: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('admin_unban_user', { p_email: email });
  if (error) throw error;
}

// ---------- 一次性登入連結(admin only;走 /api/admin/login-link)----------
export async function generateLoginLink(email: string): Promise<string> {
  const res = await fetch('/api/admin/login-link', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j as { error?: string }).error || '產生連結失敗');
  return (j as { link: string }).link;
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
  rm_id?: string;   // 指派的 RM;未提供則 = 當前登入者。最終由 deals_insert RLS 把關
}

/**
 * 建立新案件。
 *
 * 自動值:
 *   - rm_id = input.rm_id ?? 當前登入者;能否指派給別人由 deals_insert RLS 決定
 *     (admin=任何人;team_lead=自己團隊內 RM;rm=只能自己)
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
      rm_id: input.rm_id ?? user.id,
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

// ============================================================
// Phase 4 補回:Plan step toggle / 刪除案件 / 設聯繫日 / 強連 intel
// ============================================================

// 對應 deals.plan(JSONB)某一步驟的 completed 狀態反轉
export async function togglePlanStep(dealId: string, stepId: string): Promise<void> {
  const supabase = createClient();
  const { data: row, error: readErr } = await supabase
    .from('deals')
    .select('plan')
    .eq('id', dealId)
    .single();
  if (readErr) throw readErr;
  const plan = (row?.plan as { steps?: Array<{ id: string; completed?: boolean; completed_at?: string | null }> } | null) ?? null;
  if (!plan?.steps) throw new Error('此案件還沒有 saved plan');
  const nextSteps = plan.steps.map((s) => s.id === stepId ? {
    ...s,
    completed: !s.completed,
    completed_at: !s.completed ? new Date().toISOString() : null,
  } : s);
  const nextPlan = { ...plan, steps: nextSteps };
  const { error } = await supabase
    .from('deals')
    .update({ plan: nextPlan, last_updated: new Date().toISOString() })
    .eq('id', dealId);
  if (error) throw error;
}

// 刪除案件(audit log trigger 會記錄,admin 可用 docs/RECOVERY.md 兩行 SQL 還原)
export async function deleteDeal(dealId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('deals').delete().eq('id', dealId);
  if (error) throw error;
}

// 顯式設定 last_contact_at 為任意日期(跟 markContacted 不同 — markContacted 強制 now)
export async function setLastContactAt(dealId: string, iso: string | null): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('deals')
    .update({ last_contact_at: iso, last_updated: new Date().toISOString() })
    .eq('id', dealId);
  if (error) throw error;
}

// 把 intel 直接關聯到 deal(供 client_talking_points 採納用)
// upsert intel_deal_links;RLS:can_access_deal + intel 可讀
export async function linkIntelToDeal(
  intelId: string,
  dealId: string,
  reason = '',
): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('intel_deal_links')
    .upsert({
      intel_id: intelId,
      deal_id: dealId,
      relevance_reason: reason,
      linked_by: user?.id ?? null,
    }, { onConflict: 'intel_id,deal_id', ignoreDuplicates: false });
  if (error) throw error;
}
