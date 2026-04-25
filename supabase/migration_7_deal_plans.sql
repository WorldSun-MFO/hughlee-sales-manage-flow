-- ============================================================
-- Migration 7 — AI 規劃成交路徑(直接存在 deals 表的 JSONB 欄)
-- ============================================================
-- 一個 deal 同時最多一個 active 計畫,重新規劃會直接覆寫 plan 欄。
-- ============================================================

alter table public.deals
  add column if not exists target_close_date date;

alter table public.deals
  add column if not exists plan jsonb;

-- 把 plan 欄位也納入 Realtime 同步(deals 表已在 publication 中,新欄位會自動同步)
-- 不需要額外指令
