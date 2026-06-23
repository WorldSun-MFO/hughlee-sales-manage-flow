-- ============================================================
-- Migration 30 — deals 加 expected_payment_date(預計收款日)
-- ============================================================
-- 用途:成交後預計何時收到款。客戶詳情頁 / 新增案件 / 成交日確認頁皆可設定 / 顯示。
-- RLS / Realtime / Audit:沿用 deals 既有設定,不需新政策。
-- ============================================================
alter table public.deals
  add column if not exists expected_payment_date date;
