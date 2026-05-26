-- ============================================================
-- Migration 24 — comments 加 raw_body 欄
-- ============================================================
-- 背景:AI 助手套用後,原本「原話」與「AI 摘要」各存一筆 comment。改為
--   把原話一併存進 AI 摘要那筆的 raw_body —— 活動紀錄只顯示 AI 摘要,
--   hover 可預覽原話、點開看全文。
--
-- 影響:
--   - 純加欄(nullable),既有資料不受影響(舊的獨立 is_raw 原話仍照舊顯示)。
--   - 不需改 RLS(raw_body 不涉權限判斷)。
--   - comments 的 audit trigger 用 to_jsonb(NEW) 全表抓取,會自動含 raw_body。
-- ============================================================

alter table public.comments
  add column if not exists raw_body text;
