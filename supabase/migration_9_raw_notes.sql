-- ============================================================
-- Migration 9 — 原始對話內容保留(Sprint A)
-- 讓 RM 描述客戶互動的原文,跟 AI 摘要分開存。
-- 之後新增任務追蹤系統的 tasks 表會在 migration_10。
-- ============================================================

-- comments 加 is_raw 欄,標記為「原始記錄」(語音/打字未經 AI 處理)
alter table public.comments
  add column if not exists is_raw boolean not null default false;

create index if not exists idx_comments_deal_raw
  on public.comments(deal_id, is_raw, created_at desc);

-- 加 2 週警示常數到 settings(可調)— 跟現有 staleDays(30)分開
-- 用 jsonb 直接擴充 red_flag 不破壞既有設定
update public.settings
  set red_flag = jsonb_set(red_flag, '{contactWarnDays}', '14'::jsonb, true)
  where id = 1 and not (red_flag ? 'contactWarnDays');
