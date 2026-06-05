import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { suggestFreeSlots } from '@/lib/google/calendar';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================
// 建議開會時段 —— 查與會者 free/busy,回傳大家都有空的時段(含日期)
// ============================================================
// 前端在「新增任務」選了協作人後自動呼叫:帶與會者(assignee + 協作者)的
// profile id + 預計時長。後端用當前操作者的 Google token 查 free/busy,從
// 現在的下一個半天往後掃,回傳最近 5 個大家都有空的時段(date + start + end)。
// ============================================================

type Body = { attendeeIds?: string[]; durationMin?: number };

export async function POST(req: Request) {
  const authed = await createClient();
  const { data: { user } } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_TOKEN_ENC_KEY) {
    return NextResponse.json({ error: '行事曆功能尚未設定' }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || !Array.isArray(body.attendeeIds)) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }
  const durationMin = Math.min(Math.max(Math.round(body.durationMin ?? 60), 10), 480);

  try {
    const result = await suggestFreeSlots(user.id, body.attendeeIds, durationMin);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'no_credentials') {
      return NextResponse.json({ error: '你尚未授權 Google 行事曆,請重新登入後再試' }, { status: 400 });
    }
    if (msg === 'insufficient_scope') {
      return NextResponse.json({ error: '需要重新登入以授權「查詢空檔」權限(新加的權限)' }, { status: 400 });
    }
    console.error('[calendar/free-slots]', msg);
    return NextResponse.json({ error: '查詢空檔失敗' }, { status: 500 });
  }
}
