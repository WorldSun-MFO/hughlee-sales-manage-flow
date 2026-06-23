-- ============================================================
-- Migration 29 — deals 加 payment_received(「成交日確認」頁的「已收款」打勾)
-- ============================================================
-- 用途:管理員在 /workspace/close-dates 逐筆確認目標成交日,收到款後打勾;
--      打勾的客戶移到清單最下方、不再顯示逾期天數。
--
-- RLS:沿用既有 deals_update(rm 本人或 manager 可改),不需新政策。
-- Realtime / Audit:deals 已在 publication、audit trigger 擷取整列,自動含新欄。
-- ============================================================
alter table public.deals
  add column if not exists payment_received boolean not null default false;
