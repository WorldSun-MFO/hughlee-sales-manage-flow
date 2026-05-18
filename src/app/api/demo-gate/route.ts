import { NextResponse, type NextRequest } from 'next/server';
import { IS_DEMO, DEMO_COOKIE, demoAccessToken } from '@/lib/demo';

export const runtime = 'nodejs';

// 共用密碼閘門:密碼正確才發給一個無法偽造的 cookie token。
// 非 DEMO 環境此端點不存在意義 → 直接 404。
export async function POST(request: NextRequest) {
  if (!IS_DEMO) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  const expectedPassword = process.env.DEMO_PASSWORD ?? '';
  if (!expectedPassword) {
    return NextResponse.json({ error: 'demo password not configured' }, { status: 500 });
  }

  let password = '';
  try {
    const body = await request.json();
    password = typeof body?.password === 'string' ? body.password : '';
  } catch {
    password = '';
  }

  if (password !== expectedPassword) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const token = await demoAccessToken(expectedPassword);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEMO_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12, // 12 小時
  });
  return res;
}
