// ============================================================
// 瀏覽器端 Supabase client(Client Component / browser 用)
// ============================================================
// 用法:
//   const supabase = useMemo(() => createClient(), []);
//   await supabase.from('deals').update(...).eq('id', dealId);
//
// 認證:讀 cookie 中的 session(由 middleware 設定 / 刷新)
// 權限:走 RLS,所有寫入會被 DB 端 policy 過濾
//
// ⚠️ 不要在 Server Component / route handler 用這支 — 那邊用 server.ts
//    的版本,因為 server side 沒有 window / document。
// ============================================================
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// 本機開發:把 client 暴露到 window,讓 console 跑 signInWithPassword
// 直接進系統(本機 Supabase 沒設 Google OAuth)。
// 正式環境沒有 NEXT_PUBLIC_LOCAL_DEV → 不執行。
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_LOCAL_DEV === 'true') {
  (window as unknown as { supabase: ReturnType<typeof createClient> }).supabase = createClient();
}
