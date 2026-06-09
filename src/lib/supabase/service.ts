// ============================================================
// Service-role Supabase client(繞過 RLS,僅限 server 端使用)
// ============================================================
// ⚠️ 只能在 server(API route / server action)import。用 service role key,
//    可讀寫所有資料、繞過所有 RLS policy。
//
// 為什麼需要:行事曆同步要讀「別人」的 google_credentials(指派人 / 事件
//    建立者的 token),並把同步狀態寫回 tasks;這些都不是當前登入者本人
//    的資料,anon + cookie 那支(src/lib/supabase/server.ts)會被 RLS 擋。
//
// 既有的 /api/cron/weekly-report 也是同樣手法(當時 inline);此處抽成共用。
// ============================================================
import { createServerClient } from '@supabase/ssr';

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY 未設定 — 行事曆同步需要 service role');
  return createServerClient(url, key, {
    cookies: { getAll() { return []; }, setAll() {} },
  });
}
