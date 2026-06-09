import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { upsertTaskEvent, removeTaskEvent, recordSyncError } from '@/lib/google/calendar';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================
// CRM 任務 → Google 行事曆事件 同步
// ============================================================
// 前端在 task mutation(建立 / 更新 / 刪除)成功後 fire-and-forget 呼叫。
// 設計原則:同步是「附屬功能」,任何失敗都不該擋住任務本身的操作 —— 故
//   - 失敗一律記在 tasks.google_sync_error,HTTP 不回 5xx
//   - 缺 GCP / env 設定時安靜跳過(尚未設定完成的環境照常運作)
//
// 核心建立 / 修改 / 移除邏輯在 @/lib/google/calendar 的 upsertTaskEvent,
// 與對帳 cron(/api/cron/calendar-reconcile)共用。
// ============================================================

type Body =
  | { op: 'upsert'; taskId: string }
  | { op: 'delete'; googleEventId?: string | null; googleEventOwner?: string | null };

export async function POST(req: Request) {
  // 1) 驗證登入者(避免未授權者亂打這支)
  const authed = await createClient();
  const { data: { user } } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // 2) 缺設定 → 安靜跳過(GCP / env 還沒設好的環境不該壞)
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_TOKEN_ENC_KEY) {
    return NextResponse.json({ skipped: 'calendar sync not configured' });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: 'bad request' }, { status: 400 });

  try {
    if (body.op === 'delete') {
      // tasks row 已不在,事件資訊由前端帶入
      await removeTaskEvent(body.googleEventOwner, body.googleEventId);
      return NextResponse.json({ ok: true });
    }
    // upsert:用當前操作者作為新事件的行事曆擁有者
    const result = await upsertTaskEvent(user.id, body.taskId);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (body.op === 'upsert') await recordSyncError(body.taskId, msg);
    console.error('[calendar/sync-task]', msg);
    // 回 200:同步失敗不該讓前端的 fire-and-forget 噴錯
    return NextResponse.json({ error: 'sync failed', detail: msg });
  }
}
