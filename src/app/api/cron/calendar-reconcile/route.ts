import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { upsertTaskEvent, recordSyncError } from '@/lib/google/calendar';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ============================================================
// 行事曆同步「對帳」safety net
// ============================================================
// /api/calendar/sync-task 是即時、fire-and-forget;若當下 Google 暫時掛掉、
// token 過期等,任務會留下 google_sync_error。本 cron 定期把這些「已經有
// 行事曆擁有者(google_event_owner)、但上次同步失敗」的任務重推一次。
//
// 刻意「只重試已有 owner 的任務」:owner 為 null 代表從沒成功建過事件,
// 我們無從得知該用誰的行事曆(無人操作脈絡),交給下次有人動它時再建。
//
// 觸發:沿用 weekly-report 的 CRON_SECRET 機制。排程器(Vercel Cron /
//   去 Vercel 後的 nginx + system cron)帶 Authorization: Bearer <CRON_SECRET>。
//   尚未在 vercel.json 註冊排程 —— 待 cron 基礎建設確定後再掛。
// ============================================================
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_TOKEN_ENC_KEY) {
    return NextResponse.json({ skipped: 'calendar sync not configured' });
  }

  const svc = createServiceClient();
  const { data, error } = await svc
    .from('tasks')
    .select('id, google_event_owner')
    .not('google_sync_error', 'is', null)   // 上次同步失敗
    .not('google_event_owner', 'is', null)  // 已有行事曆擁有者可重推
    .neq('status', 'done')                  // 已完成的不需重建
    .not('due_date', 'is', null)            // 無到期日無法建全天事件
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as { id: string; google_event_owner: string }[];
  let fixed = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await upsertTaskEvent(row.google_event_owner, row.id);
      fixed++;
    } catch (e) {
      await recordSyncError(row.id, e instanceof Error ? e.message : String(e));
      failed++;
    }
  }

  return NextResponse.json({ retried: rows.length, fixed, failed });
}
