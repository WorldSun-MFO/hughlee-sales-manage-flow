import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/** GET /api/market/sources — 列出所有抓取來源(全團隊可讀) */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登入' }, { status: 401 });

  const { data, error } = await supabase
    .from('ingest_sources')
    .select('id, name, kind, url, region, active, last_run_at, last_status, created_at')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

const CreateSchema = z.object({
  name: z.string().min(1, '請填名稱'),
  url: z.string().url('網址格式不正確'),
  region: z.enum(['TW', 'US', 'JP', 'CN', 'GLOBAL']).nullable().optional(),
  active: z.boolean().optional().default(true),
});

/** POST /api/market/sources — 新增來源(RLS:僅 Manager 可寫) */
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
    .from('ingest_sources')
    .insert({
      name: body.name.trim(),
      kind: 'rss',
      url: body.url.trim(),
      region: body.region ?? null,
      active: body.active,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    const msg = error.message.includes('duplicate') || error.code === '23505'
      ? '這個網址已經在來源清單裡了'
      : error.message.includes('row-level security')
        ? '只有管理員/團隊主管可以新增來源'
        : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
