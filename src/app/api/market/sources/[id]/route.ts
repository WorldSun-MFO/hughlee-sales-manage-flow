import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  region: z.enum(['TW', 'US', 'JP', 'CN', 'GLOBAL']).nullable().optional(),
  active: z.boolean().optional(),
});

/** PATCH /api/market/sources/[id] — 改名/改地區/啟停(RLS:僅 Manager) */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登入' }, { status: 401 });

  let body;
  try {
    body = UpdateSchema.parse(await request.json());
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '輸入格式錯誤';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('ingest_sources')
    .update(body)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    const msg = error?.message.includes('row-level security')
      ? '只有管理員/團隊主管可以修改來源'
      : (error?.message ?? '找不到該來源或無權限');
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ data });
}

/** DELETE /api/market/sources/[id] — 刪除來源(RLS:僅 Manager) */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登入' }, { status: 401 });

  const { error } = await supabase.from('ingest_sources').delete().eq('id', id);
  if (error) {
    const msg = error.message.includes('row-level security')
      ? '只有管理員/團隊主管可以刪除來源'
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
