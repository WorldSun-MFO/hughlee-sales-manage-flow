// ============================================================
// Auth 守門員 — 每個 page request 進來都會先過這裡
// ============================================================
// 主要工作:
//   1. 驗證 Supabase session cookie;沒有就導到 /login
//   2. 順手 refresh session(token 過期前自動換新,使用者無感)
//   3. 已登入卻訪問 /login → 導回 /
//
// 不會過這裡的路徑(matcher 排除,見檔尾 config):
//   - /api/*       : API route 自己驗(用 lib/supabase/server.ts)
//   - /auth/*      : OAuth callback / login link 中間頁
//   - /_next/*     : 靜態資源
//   - /favicon.ico, *.png/.svg 等 : 靜態檔
//   - /v2, /v2/*   : 預留路徑
//
// Demo 模式:跳過整段認證邏輯,改用共用密碼閘門(/demo-gate)。
//          詳見 lib/demo.ts 與 src/app/demo-gate/。
//
// 觸動的資料表:public.profiles(透過 supabase.auth.getUser() 間接)
// ============================================================
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { IS_DEMO, DEMO_COOKIE, demoAccessToken } from '@/lib/demo';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

// 認證守門(非反爬蟲,別誤會):未登入 → /login;已登入訪問 /login → /
export async function middleware(request: NextRequest) {
  // ===== DEMO 模式:不碰 Supabase 認證,改用共用密碼閘門 =====
  // 正式環境沒有 NEXT_PUBLIC_DEMO_MODE → 跳過整段,走下方原認證邏輯。
  if (IS_DEMO) {
    const path = request.nextUrl.pathname;
    // 次要模組(market / mindmap)會打 Supabase,demo 一律導回首頁
    if (path.startsWith('/market') || path.startsWith('/mindmap')) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    const password = process.env.DEMO_PASSWORD ?? '';
    const expected = await demoAccessToken(password);
    const hasAccess = password.length > 0 && request.cookies.get(DEMO_COOKIE)?.value === expected;
    const isGate = path === '/demo-gate';
    if (!hasAccess) {
      return isGate ? NextResponse.next() : NextResponse.redirect(new URL('/demo-gate', request.url));
    }
    // 已通關:閘門頁 / 登入頁導回首頁
    if (isGate || path.startsWith('/login')) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // API routes 自己處理認證(/api/cron/* 給 Vercel Cron 直接打,/api/ai/* 用 supabase server client 認證)
  const isPublic =
    path.startsWith('/login') ||
    path.startsWith('/auth') ||
    path.startsWith('/api/') ||
    path.startsWith('/_next') ||
    (path === '/v2' || path.startsWith('/v2/')) ||
    path === '/favicon.ico';

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && path === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
