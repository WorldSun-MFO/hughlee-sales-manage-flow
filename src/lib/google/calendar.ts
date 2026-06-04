// ============================================================
// Google Calendar 同步核心(server-only)
// ============================================================
// 只在 server(API route / auth callback)使用 —— 會用到 service role 與
// 解密後的 token,絕不可被 client bundle 引用。
//
//   storeRefreshToken : 登入時攔到的 refresh token,加密存進 google_credentials
//   getAccessToken    : 用某使用者的 refresh token 換 1 小時的 access token
//   createEvent/...   : 對該使用者的 primary 行事曆 建 / 改 / 刪事件
//
// 任務只有 due_date(無時間)→ 一律建「全天」事件。指派對象設為與會者,
// sendUpdates=all 讓 Google 寄出邀請 / 變更通知。
// ============================================================
import { createServiceClient } from '@/lib/supabase/service';
import { encryptToken, decryptToken } from '@/lib/google/crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CAL_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

// 事件已不存在(被使用者手動刪掉)→ 呼叫端可改走「重新建立」
export class EventGoneError extends Error {
  constructor() {
    super('event_gone');
    this.name = 'EventGoneError';
  }
}

// ---------- token ----------

export async function storeRefreshToken(
  userId: string,
  refreshToken: string,
  scope?: string,
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from('google_credentials').upsert({
    user_id: userId,
    refresh_token: encryptToken(refreshToken),
    scope: scope ?? null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

// 用某使用者的 refresh token 換 access token。沒授權過行事曆 → 回 null。
export async function getAccessToken(userId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('google_credentials')
    .select('refresh_token')
    .eq('user_id', userId)
    .maybeSingle();
  if (!data?.refresh_token) return null;

  const refreshToken = decryptToken(data.refresh_token as string);
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    throw new Error(`google token refresh failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token?: string };
  return json.access_token ?? null;
}

// ---------- 事件 ----------

// 時段事件一律以台灣時間解讀(時刻欄位只存當天牆上時間,不含時區)
const EVENT_TZ = 'Asia/Taipei';

export interface EventInput {
  title: string;
  description?: string;
  dueDate: string; // YYYY-MM-DD
  startTime?: string | null; // 'HH:MM' / 'HH:MM:SS';null = 整天事件
  endTime?: string | null;   // 同上;null 或 <= startTime → startTime + 1 小時
  attendeeEmails?: string[]; // 主責人 + 協作者(已過濾為 @wsgfo.com、去重)
}

// 'HH:MM' / 'HH:MM:SS' → 'HH:MM:SS'(補秒、補零)
function normTime(t: string): string {
  const [h = '00', m = '00', s = '00'] = t.split(':');
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}`;
}

// 結束時刻:有填且晚於開始就用它,否則開始 + 1 小時(同日內,跨午夜則夾到 23:59)
function resolveEndTime(start: string, end?: string | null): string {
  const s = normTime(start);
  if (end) {
    const e = normTime(end);
    if (e > s) return e;
  }
  const [h, m] = start.split(':').map(Number);
  const total = Math.min(h * 60 + m + 60, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}:00`;
}

function eventBody(input: EventInput) {
  const attendees = input.attendeeEmails?.length
    ? input.attendeeEmails.map((email) => ({ email }))
    : undefined;
  // 不指定 reminders:Google 會自動套用該行事曆的「預設提醒」(等同
  // useDefault:true)。刻意不送 useDefault —— PATCH 既有事件時,若該事件
  // 已帶 overrides,送 useDefault:true 會與之並存而觸發 400
  // (cannotUseDefaultRemindersAndSpecifyOverride)。
  const base = { summary: input.title, description: input.description || undefined, attendees };

  // 有開始時間 → 建「時段」事件;否則整天事件(end.date 為「不含」當天,= due + 1)
  // PATCH 既有事件時,Google 不允許同一事件同時有 date 與 dateTime,故把互斥
  // 欄位顯式設 null 強制清除 —— 這樣整天↔時段雙向切換都不會觸發 400。
  if (input.startTime) {
    const startT = normTime(input.startTime);
    const endT = resolveEndTime(input.startTime, input.endTime);
    return {
      ...base,
      start: { date: null, dateTime: `${input.dueDate}T${startT}`, timeZone: EVENT_TZ },
      end: { date: null, dateTime: `${input.dueDate}T${endT}`, timeZone: EVENT_TZ },
    };
  }
  return {
    ...base,
    start: { date: input.dueDate, dateTime: null, timeZone: null },
    end: { date: addDays(input.dueDate, 1), dateTime: null, timeZone: null },
  };
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export async function createEvent(accessToken: string, input: EventInput): Promise<string> {
  const res = await fetch(`${CAL_BASE}?sendUpdates=all`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify(eventBody(input)),
  });
  if (!res.ok) throw new Error(`createEvent failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { id: string };
  return json.id;
}

export async function patchEvent(accessToken: string, eventId: string, input: EventInput): Promise<void> {
  const res = await fetch(`${CAL_BASE}/${encodeURIComponent(eventId)}?sendUpdates=all`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify(eventBody(input)),
  });
  // 事件被手動刪掉 → 404/410,當作不存在,讓呼叫端改用 createEvent
  if (res.status === 404 || res.status === 410) throw new EventGoneError();
  if (!res.ok) throw new Error(`patchEvent failed: ${res.status} ${await res.text()}`);
}

export async function deleteEvent(accessToken: string, eventId: string): Promise<void> {
  const res = await fetch(`${CAL_BASE}/${encodeURIComponent(eventId)}?sendUpdates=all`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${accessToken}` },
  });
  // 已不存在也算成功(冪等)
  if (res.ok || res.status === 404 || res.status === 410) return;
  throw new Error(`deleteEvent failed: ${res.status} ${await res.text()}`);
}

// ---------- 任務層級同步(route 與 對帳 cron 共用)----------

export interface SyncResult {
  ok: boolean;
  skipped?: string;
  eventId?: string | null;
  action?: 'created' | 'patched' | 'recreated' | 'removed';
}

// 把單一任務同步到行事曆(建立 / 修改 / 移除),並把結果寫回 tasks。
// operatorId:沒有既有事件時要用「誰」的行事曆建立 —— route 傳當前登入者,
//             對帳 cron 傳任務既有的 google_event_owner。
// 硬錯誤(token / Google API)會 throw,由呼叫端 catch 後 recordSyncError。
export async function upsertTaskEvent(operatorId: string, taskId: string): Promise<SyncResult> {
  const svc = createServiceClient();
  const { data: taskRow } = await svc
    .from('tasks')
    .select('id, title, description, due_date, start_time, end_time, status, assignee_id, participant_ids, google_event_id, google_event_owner')
    .eq('id', taskId)
    .maybeSingle();
  if (!taskRow) return { ok: false, skipped: 'task not found' };

  const t = taskRow as {
    id: string;
    title: string;
    description: string | null;
    due_date: string | null;
    start_time: string | null;
    end_time: string | null;
    status: string;
    assignee_id: string | null;
    participant_ids: string[] | null;
    google_event_id: string | null;
    google_event_owner: string | null;
  };

  // 完成 或 無到期日 → 不該留在行事曆:有事件就刪掉並清欄位
  if (t.status === 'done' || !t.due_date) {
    await removeTaskEvent(t.google_event_owner, t.google_event_id);
    await svc
      .from('tasks')
      .update({
        google_event_id: null,
        google_event_owner: null,
        google_synced_at: new Date().toISOString(),
        google_sync_error: null,
      })
      .eq('id', t.id);
    return { ok: true, action: 'removed' };
  }

  // 與會者 = 主責人 + 協作者。只有 @wsgfo.com 內部帳號才設為與會者;去重。
  const memberIds = Array.from(
    new Set([t.assignee_id, ...(t.participant_ids ?? [])].filter((x): x is string => !!x)),
  );
  let attendeeEmails: string[] = [];
  if (memberIds.length) {
    const { data: ps } = await svc
      .from('profiles')
      .select('email')
      .in('id', memberIds);
    attendeeEmails = Array.from(
      new Set(
        ((ps as { email?: string }[] | null) ?? [])
          .map((p) => p.email?.toLowerCase())
          .filter((e): e is string => !!e && e.endsWith('@wsgfo.com')),
      ),
    );
  }

  const input: EventInput = {
    title: t.title,
    description: t.description ?? '',
    dueDate: t.due_date,
    startTime: t.start_time,
    endTime: t.end_time,
    attendeeEmails,
  };

  // 既有事件 → 用「建立者」token PATCH(事件綁在他行事曆);無 → 用 operator CREATE
  const ownerId = t.google_event_owner ?? operatorId;
  const token = await getAccessToken(ownerId);
  if (!token) {
    await svc.from('tasks').update({ google_sync_error: 'no_credentials' }).eq('id', t.id);
    return { ok: false, skipped: 'no credentials' };
  }

  let eventId = t.google_event_id;
  let eventOwner = t.google_event_owner ?? operatorId;
  let action: SyncResult['action'] = 'patched';

  if (eventId) {
    try {
      await patchEvent(token, eventId, input);
    } catch (e) {
      if (e instanceof EventGoneError) {
        // 事件被手動刪了 → 用 operator 重新建立
        const freshToken = await getAccessToken(operatorId);
        if (!freshToken) throw new Error('no_credentials_for_recreate');
        eventId = await createEvent(freshToken, input);
        eventOwner = operatorId;
        action = 'recreated';
      } else throw e;
    }
  } else {
    eventId = await createEvent(token, input);
    eventOwner = operatorId;
    action = 'created';
  }

  await svc
    .from('tasks')
    .update({
      google_event_id: eventId,
      google_event_owner: eventOwner,
      google_synced_at: new Date().toISOString(),
      google_sync_error: null,
    })
    .eq('id', t.id);

  return { ok: true, eventId, action };
}

// 刪除任務對應的事件(冪等)。owner / eventId 任一缺就跳過。
export async function removeTaskEvent(
  owner: string | null | undefined,
  eventId: string | null | undefined,
): Promise<void> {
  if (!owner || !eventId) return;
  const token = await getAccessToken(owner);
  if (token) await deleteEvent(token, eventId);
}

// 把同步錯誤記回任務(供排查 / 對帳 cron 重試);永不 throw。
export async function recordSyncError(taskId: string, message: string): Promise<void> {
  const svc = createServiceClient();
  await svc
    .from('tasks')
    .update({ google_sync_error: message.slice(0, 500) })
    .eq('id', taskId)
    .then(() => {}, () => {});
}
