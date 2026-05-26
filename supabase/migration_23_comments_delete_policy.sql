-- ============================================================
-- Migration 23 — 活動紀錄(comments)開放刪除
-- ============================================================
-- 背景:comments 原本只有 SELECT / INSERT policy。RLS 之下,前端送 delete
--   會被「靜默擋掉」(0 rows、不報錯)。本 migration 補上 DELETE policy,
--   讓客戶詳情頁的「活動紀錄」可以刪除單筆。
--
-- 權限:沿用 comments_select / comments_insert 的同一存取規則 ——
--   案件負責人(deals.rm_id = auth.uid())或主管 / admin(public.is_manager())
--   可刪除該案件底下的任何 comment(含 AI 系統紀錄與 is_raw 原話)。
--
-- 安全:comments 掛有 audit trigger(AFTER INSERT OR UPDATE OR DELETE),
--   刪除會寫進 audit_log,admin 可依 docs/SECURITY.md 還原。
--   本 migration 不更動 audit_log 的任何 policy(紅線)。
-- ============================================================

-- 用 can_access_deal() helper(= rm_id = auth.uid() or is_manager()),
-- 與 comments_select / comments_insert 同一存取規則,也對齊 docs/SECURITY.md 附錄 A。
drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments for delete to authenticated
  using (public.can_access_deal(deal_id));
