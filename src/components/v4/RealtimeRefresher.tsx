'use client';

// ============================================================
// V4 Realtime 同步器 — 訂閱 Supabase Realtime,有變動就 router.refresh()
// ============================================================
// 沿用 ws_crm 既有 useRealtimeSync.ts 的訂閱策略,只是把「重抓 + 局部更新」
// 改成「整頁 router.refresh()」 — 因為 v4 用 Next.js server component +
// inline edit + router.refresh 模式,refresh 會重跑 server data fetch,
// UI 自動拿到新狀態,不需要本地手動 merge。
//
// 訂閱 7 個表:
//   - deals       (新增 / 編輯 / 刪除案件)
//   - scores      (MEDDIC 分數)
//   - score_notes (分數理由)
//   - stage_checklist (推進閘 checklist)
//   - deal_questions  (待澄清題目)
//   - tasks       (任務 CRUD)
//   - comments    (時間軸 / AI 摘要)
//
// 用法:在 view component 內 <RealtimeRefresher />,渲染 null,完全不佔位。
// 也可以 props 限縮要監聽的表(例如 ClientDetailView 不需要 tasks 以外的全部)。
//
// ⚠️ fixtures 模式不訂閱(沒登入,Supabase realtime 連不上)
// ============================================================
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const DEFAULT_TABLES = [
  'deals',
  'scores',
  'score_notes',
  'stage_checklist',
  'deal_questions',
  'tasks',
  'comments',
] as const;

export function RealtimeRefresher({
  isFixtures,
  tables = [...DEFAULT_TABLES],
}: {
  isFixtures: boolean;
  tables?: readonly string[];
}) {
  const router = useRouter();
  const key = tables.join(',');

  useEffect(() => {
    if (isFixtures) return;
    const supabase = createClient();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    function scheduleRefresh() {
      if (debounceTimer) clearTimeout(debounceTimer);
      // 短時間(300ms)內多筆變動合併成一次 refresh,避免 burst 連 5 次 server fetch
      debounceTimer = setTimeout(() => { router.refresh(); }, 300);
    }

    const channels = key.split(',').map((t) =>
      supabase
        .channel(`v4-rt-${t}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: t }, () => scheduleRefresh())
        .subscribe()
    );

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [isFixtures, key, router]);

  return null;
}
