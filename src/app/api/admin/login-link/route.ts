import { NextResponse } from 'next/server';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { createClient as createAdminSupabase } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 管理員產生「不經 Google」的一次性登入連結。
// - middleware 排除 /api/*,故此處務必自行驗證呼叫者是已登入 admin。
// - service role 金鑰只在 server 用,絕不回傳前端。
// - 只為「已是團隊成員(profiles 有此 email)」者產生,與 migration_21 白名單一致。
// - 連結固定指向正式站(與 Supabase Redirect URL 允許清單一致)。
const SITE = 'https://hughlee-sales-manage-flow.vercel.app';

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: uErr,
  } = await supabase.auth.getUser();
  if (uErr || !user) {
    return NextResponse.json({ error: '未登入' }, { status: 401 });
  }
  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if ((me as { role?: string } | null)?.role !== 'admin') {
    return NextResponse.json({ error: '僅限管理員操作' }, { status: 403 });
  }

  let email = '';
  try {
    const body = (await req.json()) as { email?: unknown };
    email = String(body?.email ?? '').trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: '請提供 email' }, { status: 400 });
  }
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: '請提供有效的 email' }, { status: 400 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      { error: '伺服器未設定 service role key,請聯絡系統維護者' },
      { status: 500 },
    );
  }
  const admin = createAdminSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // 必須已是團隊成員(用 service role 查,避開 RLS 邊界)
  const { data: target } = await admin
    .from('profiles')
    .select('id')
    .ilike('email', email)
    .maybeSingle();
  if (!target) {
    return NextResponse.json(
      { error: `「${email}」不在團隊成員清單。請先用「新增成員」加入,再產生連結。` },
      { status: 404 },
    );
  }

  const redirectTo = `${SITE}/auth/callback`;
  let gen = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo },
  });
  if (gen.error && /already|registered|exist/i.test(gen.error.message || '')) {
    gen = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo },
    });
  }
  const props = gen.data?.properties as
    | { hashed_token?: string; verification_type?: string }
    | undefined;
  if (gen.error || !props?.hashed_token) {
    return NextResponse.json(
      { error: gen.error?.message || '產生連結失敗' },
      { status: 500 },
    );
  }

  const link = `${SITE}/auth/callback?token_hash=${props.hashed_token}&type=${props.verification_type}`;
  return NextResponse.json({ link });
}
