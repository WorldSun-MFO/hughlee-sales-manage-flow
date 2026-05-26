'use client';

// ============================================================
// V4 Realtime 同步器 — v4.2:預設停用
// ============================================================
// 為什麼停用:
//   v4.1 改成 fire-and-forget 後,使用者點按鈕本地 state 立刻翻面。
//   但這個元件仍訂閱 Supabase Realtime,DB 一變(包括自己剛寫的)
//   就 router.refresh() → 700ms 整頁 server fetch + middleware re-auth
//   → 偶發 redirect /login。
//
//   既然單人開發、沒有「別人改我立刻看到」的剛性需求,先預設停用。
//   多人協作時把 ENABLED 改 true,並考慮加上「只 refresh 別人寫的」
//   的過濾(取得 payload.commit_timestamp 比對自己寫入時間之類)。
//
// 如何重新啟用:把 ENABLED 改 true,或刪掉這個 early-return。
// 用法 API 不變,既有頁面繼續 import 它。
// ============================================================
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const ENABLED = false; // ← 改 true 即開啟

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
    if (!ENABLED) return;
    if (isFixtures) return;
    const supabase = createClient();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    function scheduleRefresh() {
      if (debounceTimer) clearTimeout(debounceTimer);
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
