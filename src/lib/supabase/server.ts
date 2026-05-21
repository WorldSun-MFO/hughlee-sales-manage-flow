// ============================================================
// 伺服器端 Supabase client(Server Component / API Route 用)
// ============================================================
// 用法:
//   const supabase = await createClient();
//   const { data: { user } } = await supabase.auth.getUser();
//
// 認證:讀 Next.js 的 cookies(),會自動拿到 middleware 已驗證的 session
// 權限:走 RLS,跟 client 端一樣會被 policy 過濾
//
// 用在哪裡:
//   - src/app/page.tsx               : 首次 SSR 抓所有 deals
//   - src/app/api/ai/* 所有 route    : 驗證使用者 + 抓 deal context
//   - src/app/auth/callback/route.ts : OAuth code 換 session
//   - src/app/api/admin/login-link   : 驗 admin
//
// ⚠️ 不是 service role!這支用 anon key + cookie session,仍受 RLS 限制。
//    要繞 RLS 的場景(只有 /api/cron/weekly-report)直接用 @supabase/supabase-js
//    + SUPABASE_SERVICE_ROLE_KEY,別放這支。
// ============================================================
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from Server Component — can be ignored when middleware refreshes
          }
        },
      },
    }
  );
}
