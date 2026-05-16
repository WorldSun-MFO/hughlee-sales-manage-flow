import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/** GET /api/market/suggestions?dealId=xxx — 該客戶的待審配對建議
 *  RLS(can_access_deal)自動把關:看不到別的 RM 客戶的建議。 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登入' }, { status: 401 });

  const dealId = new URL(request.url).searchParams.get('dealId')?.trim();
  if (!dealId) return NextResponse.json({ error: '缺少 dealId' }, { status: 400 });

  const { data, error } = await supabase
    .from('intel_link_suggestions')
    .select(`
      id, intel_id, deal_id, relevance_reason, status, created_at,
      intel:market_intel(id, title, summary, stance, region, source_name)
    `)
    .eq('deal_id', dealId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
