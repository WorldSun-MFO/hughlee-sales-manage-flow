-- ============================================================
-- Migration 28 — 任務時間段(開始 / 結束時間)
-- ============================================================
-- 任務原本只有 due_date(日期)→ 行事曆一律建「整天」事件。
-- 新增 start_time / end_time(當天的時刻),用來表達「幾點開會 / 幾點做事」:
--   - 有 start_time → 行事曆建「該時段」的事件(timeZone = Asia/Taipei)
--     end_time 沒填或 <= start_time → 預設為 start_time + 1 小時
--   - 沒 start_time → 維持原本的整天事件
--   - 沒 due_date → 不建事件(時間無意義)
-- 時刻只存「當天牆上時間」,時區在同步時統一套台灣;故用 time 而非 timestamptz。
-- ============================================================

alter table public.tasks
  add column if not exists start_time time,   -- 當天開始時刻(null = 整天)
  add column if not exists end_time   time;   -- 當天結束時刻(null 則同步時預設 +1 小時)
