import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/** GET /api/mindmap/nodes
 * 預設回傳當前使用者所有節點(扁平 list,client 端組樹)。
 * Query params:
 *   ?inbox=1     只回 inbox 節點
 *   ?parent=ID   只回特定 parent 下的子節點
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登入' }, { status: 401 });

  const url = new URL(request.url);
  const inboxOnly = url.searchParams.get('inbox') === '1';
  const parentId = url.searchParams.get('parent');

  let query = supabase
    .from('mindmap_nodes')
    .select('*')
    .eq('owner_id', user.id)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (inboxOnly) query = query.eq('is_inbox', true);
  if (parentId !== null) {
    query = parentId === 'null' ? query.is('parent_id', null) : query.eq('parent_id', parentId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

const CreateSchema = z.object({
  content: z.string().default(''),
  parent_id: z.string().uuid().nullable().optional(),
  tags: z.array(z.string()).optional(),
  is_inbox: z.boolean().optional(),
  voice_url: z.string().url().nullable().optional(),
});

/** POST /api/mindmap/nodes  建新節點 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登入' }, { status: 401 });

  let body;
  try {
    body = CreateSchema.parse(await request.json());
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '輸入格式錯誤';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('mindmap_nodes')
    .insert({
      owner_id: user.id,
      content: body.content ?? '',
      parent_id: body.parent_id ?? null,
      tags: body.tags ?? [],
      is_inbox: body.is_inbox ?? false,
      voice_url: body.voice_url ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
