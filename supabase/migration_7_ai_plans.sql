-- ============================================================
-- Migration 7 — AI 輔助功能 (路徑規劃 + 對話記錄)
-- 1) deals 加 target_close_date + plan 欄(儲存 AI 產出的成交計畫)
-- ============================================================

-- 目標成交日期
alter table public.deals
  add column if not exists target_close_date date;

-- AI 產出的成交計畫(含 steps 陣列,每 step 有 completed 狀態)
-- 結構:
-- {
--   "target_date": "2026-05-31",
--   "generated_at": "2026-04-24T10:00:00Z",
--   "model": "claude-sonnet-4-6",
--   "overview": "...",
--   "risks": ["..."],
--   "steps": [
--     {
--       "id": "s1",
--       "title": "...",
--       "target_date": "2026-04-30",
--       "stage_transition": "L3→L4",
--       "focus": ["..."],
--       "talking_points": ["..."],
--       "risks": ["..."],
--       "completed": false,
--       "completed_at": null
--     }
--   ]
-- }
alter table public.deals
  add column if not exists plan jsonb default null;
