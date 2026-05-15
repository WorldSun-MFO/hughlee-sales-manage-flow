import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { resolveTagIds, syncIntelTags, syncIntelDealLinks } from '@/lib/market/tags';

export const runtime = 'nodejs';

const TagSchema = z.object({
  name: z.string().min(1),
  category: z.enum(['region', 'industry', 'ticker', 'macro', 'theme']),
});

const CreateSchema = z.object({
  title: z.string().min(1, '標題不能空白'),
  source_type: z.enum(['broker_research', 'media', 'filing', 'internal']).default('internal'),
  source_name: z.string().optional().default(''),
  source_url: z.string().optional().default(''),
  region: z.enum(['TW', 'US', 'JP', 'CN', 'GLOBAL']).default('TW'),
  summary: z.string().optional().default(''),
  key_points: z.array(z.string()).optional().default([]),
  stance: z.enum(['bullish', 'bearish', 'neutral', 'na']).default('na'),
  author: z.string().optional().default(''),
  published_at: z.string().nullable().optional(),
  tags: z.array(TagSchema).optional().default([]),
  deal_links: z
    .array(z.object({ deal_id: z.string().min(1), relevance_reason: z.string().optional().default('') }))
    .optional()
    .default([]),
});

/** GET /api/market/intel — 列表(全團隊共享,RLS 已開放讀) */
export async function GET() {
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
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

/** POST /api/market/intel — 新增情報 + 標籤 */
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

  const { data: intel, error } = await supabase
    .from('market_intel')
    .insert({
      title: body.title,
      source_type: body.source_type,
      source_name: body.source_name,
      source_url: body.source_url,
      region: body.region,
      summary: body.summary,
      key_points: body.key_points,
      stance: body.stance,
      author: body.author,
      published_at: body.published_at || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error || !intel) {
    return NextResponse.json({ error: error?.message ?? '建立失敗' }, { status: 500 });
  }

  if (body.tags.length > 0) {
    const tagIds = await resolveTagIds(supabase, body.tags);
    await syncIntelTags(supabase, intel.id, tagIds);
  }

  if (body.deal_links.length > 0) {
    await syncIntelDealLinks(supabase, intel.id, user.id, body.deal_links);
  }

  return NextResponse.json({ data: intel }, { status: 201 });
}
