import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const ActionSchema = z.object({ action: z.enum(['accept', 'dismiss']) });

/** PATCH /api/market/suggestions/[id] — 採納或忽略一筆配對建議
 *  RLS(can_access_deal)把關:只能處理自己有權限的客戶。 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登入' }, { status: 401 });

  let body;
  try {
    body = ActionSchema.parse(await request.json());
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '輸入格式錯誤';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // 讀建議(RLS 確保只讀得到自己有權限客戶的)
  const { data: sugg, error: readErr } = await supabase
    .from('intel_link_suggestions')
    .select('id, intel_id, deal_id, relevance_reason, status')
    .eq('id', id)
    .maybeSingle();

  if (readErr || !sugg) {
    return NextResponse.json({ error: '找不到這筆建議或無權限' }, { status: 404 });
  }
  if (sugg.status !== 'pending') {
    return NextResponse.json({ error: '這筆建議已處理過' }, { status: 409 });
  }

  if (body.action === 'accept') {
    // 寫入正式關聯(已存在則略過);RLS:can_access_deal 把關
    const { error: linkErr } = await supabase
      .from('intel_deal_links')
      .upsert(
        {
          intel_id: sugg.intel_id,
          deal_id: sugg.deal_id,
          relevance_reason: sugg.relevance_reason ?? '',
          linked_by: user.id,
        },
        { onConflict: 'intel_id,deal_id', ignoreDuplicates: true }
      );
    if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 });
  }

  const { error: updErr } = await supabase
    .from('intel_link_suggestions')
    .update({
      status: body.action === 'accept' ? 'accepted' : 'dismissed',
      decided_by: user.id,
      decided_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, action: body.action });
}
