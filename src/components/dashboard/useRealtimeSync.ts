// ============================================================
// useRealtimeSync — 訂閱 Supabase Realtime,變動時刷新本地 state
// ============================================================
// 把原本散在 Dashboard.tsx 的 channel 訂閱 + 5 支 refetch helper 收進來。
//
// 訂閱 10 張表,任何一張改動 → 走對應的 refetch:
//   deals / scores / score_notes / stage_checklist / deal_questions /
//   comments / deal_attachments → refetchDeals (帶整包 join)
//   profiles → refetchProfiles
//   pain_points → refetchPainPoints
//   teams → refetchTeams
//   tasks → refetchTasks
//
// refetchDeals 用 250ms debounce 避免短時間多次寫入(例如 batch 升級任務)
// 連續打 N 次 query。
//
// Demo 模式直接 noop,不連 Supabase。
//
// ⚠️ 這個 hook 只訂閱 + 改 state。任何「寫入動作」仍在 Dashboard 主檔。
//    這樣可以保留 optimistic update 的邏輯(寫入後立刻改本地,realtime
//    再回頭刷一次跟 server 對齊)。
// ============================================================
'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Deal, PainPoint, Profile, Task, Team } from '@/lib/types';
import { IS_DEMO } from '@/lib/demo';

interface Setters {
  setDeals: (deals: Deal[]) => void;
  setProfiles: (profiles: Profile[]) => void;
  setPainPoints: (painPoints: PainPoint[]) => void;
  setTeams: (teams: Team[]) => void;
  setTasks: (tasks: Task[]) => void;
}

export function useRealtimeSync(supabase: SupabaseClient, setters: Setters) {
  const refetchTimer = useRef<number | null>(null);

  // 抓 deal 的完整 select 字串(跟 src/app/page.tsx 那份一致;改要同步改)
  const refetchDeals = useCallback(() => {
    if (refetchTimer.current) window.clearTimeout(refetchTimer.current);
    refetchTimer.current = window.setTimeout(async () => {
      const { data } = await supabase
        .from('deals')
        .select('*, scores(*), score_notes(*), stage_checklist(*), deal_questions(*), deal_attachments(*), comments(id, deal_id, author_id, body, is_system, is_raw, created_at), rm:profiles!deals_rm_id_fkey(id, email, full_name, rm_code, role)')
        .order('last_updated', { ascending: false });
      if (data) setters.setDeals(data as Deal[]);
    }, 250);
  }, [supabase, setters]);

  const refetchProfiles = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('full_name');
    if (data) setters.setProfiles(data as Profile[]);
  }, [supabase, setters]);

  const refetchPainPoints = useCallback(async () => {
    const { data } = await supabase.from('pain_points').select('*').eq('is_active', true).order('order_idx');
    if (data) setters.setPainPoints(data as PainPoint[]);
  }, [supabase, setters]);

  const refetchTeams = useCallback(async () => {
    const { data } = await supabase.from('teams').select('*').order('name');
    if (data) setters.setTeams(data as Team[]);
  }, [supabase, setters]);

  const refetchTasks = useCallback(async () => {
    const { data } = await supabase.from('tasks').select('*').order('due_date', { ascending: true, nullsFirst: false });
    if (data) setters.setTasks(data as Task[]);
  }, [supabase, setters]);

  useEffect(() => {
    if (IS_DEMO) return; // demo 不連 Supabase,無 realtime
    const channel = supabase
      .channel('pipeline-sync')
      // deals 主表與所有子表 → refetchDeals(帶整包 join)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, () => refetchDeals())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, () => refetchDeals())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'score_notes' }, () => refetchDeals())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stage_checklist' }, () => refetchDeals())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => refetchDeals())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deal_questions' }, () => refetchDeals())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deal_attachments' }, () => refetchDeals())
      // 其他清單 → 各自 refetch
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => refetchProfiles())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pain_points' }, () => refetchPainPoints())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => refetchTeams())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => refetchTasks())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // 故意空依賴 — 避免 setters 物件 reference 變動觸發 re-subscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
