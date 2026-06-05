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
const FREEBUSY_URL = 'https://www.googleapis.com/calendar/v3/freeBusy';

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

// ============================================================
// 空檔建議(FreeBusy)—— 選了協作人就自動推薦「大家都有空」的開會時段
// ============================================================
// 用 operator 的 token 查與會者(@wsgfo.com)未來數天的忙碌區間,取交集後,
// 以「半天」為單位、只在平日(跳過六日)、從現在的下一個半天起往後掃,
// 每個半天取最早可用時段,推薦最近 5 個(含日期)。
//
// 時段偏好:主要 10:00–17:00(各半天的核心),不夠才用次要 09:00–18:00 的
//   邊緣時段補。午休 12–13 不排。
//
// 「半天往後」邏輯:現在是早上 → 最推薦今天下午;現在是下午/晚上 → 最推薦
//   隔天早上;某半天排不下就順延到下一個(平日)半天。Google 無公開「智慧
//   找時間」API,交集演算法自己做。

const TZ_OFFSET = '+08:00'; // 台灣固定 +08:00,無日光節約,可硬編
// 半天視窗:primary = 主要(核心)時段;full = 次要(含 09–10、17–18 邊緣)
const MORNING_PRIMARY: [string, string] = ['10:00', '12:00'];
const MORNING_FULL: [string, string] = ['09:00', '12:00'];
const AFTERNOON_PRIMARY: [string, string] = ['13:00', '17:00'];
const AFTERNOON_FULL: [string, string] = ['13:00', '18:00'];
const SEARCH_DAYS = 21; // 往後最多找幾天(跳過週末,需多留幾天)
const NEED_SLOTS = 5;

// date 'YYYY-MM-DD' + 'HH:MM' → epoch(ms),以台灣時間解讀
function taipeiEpoch(date: string, hm: string): number {
  return new Date(`${date}T${hm}:00${TZ_OFFSET}`).getTime();
}

// epoch(ms)→ 台灣當地 'HH:MM'
function epochToTaipeiHHMM(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Taipei', hour12: false, hour: '2-digit', minute: '2-digit',
  });
}

// 在 [winStart, winEnd] 視窗內、扣掉 merged 忙碌後,回傳最早可塞下 dur 的開始
// epoch(進位到 10 分整點);塞不下回 null。
function firstFreeStart(winStart: number, winEnd: number, merged: [number, number][], dur: number): number | null {
  const gaps: [number, number][] = [];
  let cursor = winStart;
  for (const [bs, be] of merged) {
    if (be <= winStart) continue;
    if (bs >= winEnd) break;
    if (Math.min(bs, winEnd) > cursor) gaps.push([cursor, Math.min(bs, winEnd)]);
    cursor = Math.max(cursor, be);
    if (cursor >= winEnd) break;
  }
  if (cursor < winEnd) gaps.push([cursor, winEnd]);
  for (const [gs, ge] of gaps) {
    const s = Math.ceil(gs / 600_000) * 600_000; // 進位到下一個 10 分整點
    if (s + dur <= ge) return s;
  }
  return null;
}

export interface FreeSlot {
  date: string;  // 'YYYY-MM-DD'
  start: string; // 'HH:MM' 台灣當地
  end: string;   // 'HH:MM'
  offPeak?: boolean; // true = 落在次要(09–10 / 17–18)邊緣時段
}

export async function suggestFreeSlots(
  operatorId: string,
  attendeeUserIds: string[],
  durationMin: number,
): Promise<{ slots: FreeSlot[]; note?: string }> {
  const svc = createServiceClient();
  const ids = Array.from(new Set(attendeeUserIds.filter(Boolean)));
  if (!ids.length) return { slots: [], note: '沒有指定與會者' };

  const { data: ps } = await svc.from('profiles').select('id, email').in('id', ids);
  const emails = Array.from(new Set(
    ((ps as { id: string; email?: string }[] | null) ?? [])
      .map((p) => p.email?.toLowerCase())
      .filter((e): e is string => !!e && e.endsWith('@wsgfo.com')),
  ));
  if (!emails.length) return { slots: [], note: '與會者沒有可查詢的公司帳號' };

  const token = await getAccessToken(operatorId);
  if (!token) throw new Error('no_credentials');

  // 決定起算半天:現在(台灣)早上 → 今天下午起;否則 → 隔天早上起
  const nowMs = Date.now();
  const todayStr = new Date(nowMs).toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }); // 'YYYY-MM-DD'
  const taipeiHour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Taipei', hour: '2-digit', hour12: false }).format(nowMs),
  );
  const startDate = taipeiHour < 12 ? todayStr : addDays(todayStr, 1);
  const skipMorningFirstDay = taipeiHour < 12; // 早上設定 → 跳過今天上午,從今天下午開始

  // 一次查整段範圍的 free/busy
  const res = await fetch(FREEBUSY_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      timeMin: `${startDate}T00:00:00${TZ_OFFSET}`,
      timeMax: `${addDays(startDate, SEARCH_DAYS)}T00:00:00${TZ_OFFSET}`,
      timeZone: 'Asia/Taipei',
      items: emails.map((id) => ({ id })),
    }),
  });
  if (res.status === 403) throw new Error('insufficient_scope');
  if (!res.ok) throw new Error(`freeBusy failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as {
    calendars?: Record<string, { busy?: { start: string; end: string }[]; errors?: unknown[] }>;
  };

  const raw: [number, number][] = [];
  const unreadable: string[] = [];
  for (const email of emails) {
    const cal = json.calendars?.[email];
    if (!cal || (cal.errors && cal.errors.length)) { unreadable.push(email); continue; }
    for (const b of cal.busy ?? []) raw.push([new Date(b.start).getTime(), new Date(b.end).getTime()]);
  }
  // 合併所有人的忙碌區間(union)
  const merged: [number, number][] = [];
  for (const [s0, e0] of raw.filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0])) {
    const last = merged[merged.length - 1];
    if (last && s0 <= last[1]) last[1] = Math.max(last[1], e0);
    else merged.push([s0, e0]);
  }

  // 從起算半天往後(只平日),每個半天取最早可用時段。優先用「主要時段
  // (10–17)」湊滿 5 個;主要不夠時才用「次要邊緣(09–18)」補。
  const dur = durationMin * 60_000;
  const primary: FreeSlot[] = [];
  const secondary: FreeSlot[] = [];
  for (let i = 0; i < SEARCH_DAYS && primary.length < NEED_SLOTS; i += 1) {
    const d = addDays(startDate, i);
    const [yy, mm, dd] = d.split('-').map(Number);
    const dow = new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay(); // 0=日 .. 6=六
    if (dow === 0 || dow === 6) continue; // 跳過週末

    const blocks: { primary: [string, string]; full: [string, string]; morning: boolean }[] = [
      { primary: MORNING_PRIMARY, full: MORNING_FULL, morning: true },
      { primary: AFTERNOON_PRIMARY, full: AFTERNOON_FULL, morning: false },
    ];
    for (const blk of blocks) {
      if (primary.length >= NEED_SLOTS) break;
      if (i === 0 && skipMorningFirstDay && blk.morning) continue; // 今天上午已過,跳過
      // 先找主要(核心)時段
      const ps = firstFreeStart(taipeiEpoch(d, blk.primary[0]), taipeiEpoch(d, blk.primary[1]), merged, dur);
      if (ps != null) {
        primary.push({ date: d, start: epochToTaipeiHHMM(ps), end: epochToTaipeiHHMM(ps + dur) });
        continue;
      }
      // 核心排不下 → 找次要(含邊緣)時段,先暫存,主要不足時才補
      const ss = firstFreeStart(taipeiEpoch(d, blk.full[0]), taipeiEpoch(d, blk.full[1]), merged, dur);
      if (ss != null) secondary.push({ date: d, start: epochToTaipeiHHMM(ss), end: epochToTaipeiHHMM(ss + dur), offPeak: true });
    }
  }
  // 主要時段優先;不足 5 個再用次要邊緣補滿
  const slots = primary.slice(0, NEED_SLOTS);
  for (const s of secondary) {
    if (slots.length >= NEED_SLOTS) break;
    slots.push(s);
  }

  const note = unreadable.length
    ? `有 ${unreadable.length} 位同事的行事曆無法查詢(可能未授權),結果僅供參考`
    : undefined;
  return { slots, note };
}
