import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { resolveTagIds, syncIntelTags } from '@/lib/market/tags';

export const runtime = 'nodejs';

const TagSchema = z.object({
  name: z.string().min(1),
  category: z.enum(['region', 'industry', 'ticker', 'macro', 'theme']),
});

const UpdateSchema = z.object({
  title: z.string().min(1).optional(),
  source_type: z.enum(['broker_research', 'media', 'filing', 'internal']).optional(),
  source_name: z.string().optional(),
  source_url: z.string().optional(),
  region: z.enum(['TW', 'US', 'JP', 'CN', 'GLOBAL']).optional(),
  summary: z.string().optional(),
  key_points: z.array(z.string()).optional(),
  stance: z.enum(['bullish', 'bearish', 'neutral', 'na']).optional(),
  author: z.string().optional(),
  published_at: z.string().nullable().optional(),
  tags: z.array(TagSchema).optional(),
});

/** GET /api/market/intel/[id] — 讀單筆(含標籤) */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登入' }, { status: 401 });

  const { data, error } = await supabase
    .from('market_intel')
    .select(`
      *,
      intel_tags(market_tags(id, name, category)),
      creator:profiles!market_intel_created_by_fkey(full_name)
    `)
    .eq('id', id)
    .single();

  if (error || !data) return NextResponse.json({ error: '找不到這筆情報' }, { status: 404 });
  return NextResponse.json({ data });
}

/** PATCH /api/market/intel/[id] — 更新(只有作者或 admin,RLS 已把關) */
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

  const { tags, ...fields } = body;
  const patch: Record<string, unknown> = { ...fields };
  if ('published_at' in patch) patch.published_at = patch.published_at || null;

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from('market_intel').update(patch).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (tags) {
    const tagIds = await resolveTagIds(supabase, tags);
    await syncIntelTags(supabase, id, tagIds);
  }

  const { data, error: readErr } = await supabase
    .from('market_intel')
    .select(`*, intel_tags(market_tags(id, name, category)), creator:profiles!market_intel_created_by_fkey(full_name)`)
    .eq('id', id)
    .single();

  if (readErr || !data) return NextResponse.json({ error: '更新後讀取失敗(可能無權限)' }, { status: 404 });
  return NextResponse.json({ data });
}

/** DELETE /api/market/intel/[id] — 刪除(RLS:作者或 admin) */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登入' }, { status: 401 });

  const { error } = await supabase.from('market_intel').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
