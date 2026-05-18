import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { IS_DEMO, DEMO_COOKIE, demoAccessToken } from '@/lib/demo';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

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
