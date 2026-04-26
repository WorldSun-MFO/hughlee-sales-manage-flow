import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const UpdateSchema = z.object({
  content: z.string().optional(),
  parent_id: z.string().uuid().nullable().optional(),
  tags: z.array(z.string()).optional(),
  is_inbox: z.boolean().optional(),
  position: z.number().int().optional(),
  voice_url: z.string().url().nullable().optional(),
});

/** GET /api/mindmap/nodes/[id]  讀單一節點 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登入' }, { status: 401 });

  const { data, error } = await supabase
    .from('mindmap_nodes')
    .select('*')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single();

  if (error || !data) return NextResponse.json({ error: '找不到節點' }, { status: 404 });
  return NextResponse.json({ data });
}

/** PATCH /api/mindmap/nodes/[id]  更新節點 */
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
    .from('mindmap_nodes')
    .update(body)
    .eq('id', id)
    .eq('owner_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: '找不到節點或無權限' }, { status: 404 });
  return NextResponse.json({ data });
}

/** DELETE /api/mindmap/nodes/[id]  刪除節點(含子樹) */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登入' }, { status: 401 });

  const { error } = await supabase
    .from('mindmap_nodes')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
