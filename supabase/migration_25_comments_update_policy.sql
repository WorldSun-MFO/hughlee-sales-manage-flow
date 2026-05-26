-- ============================================================
-- Migration 25 — 活動紀錄(comments)開放編輯
-- ============================================================
-- 背景:comments 原本只有 SELECT / INSERT(+ migration_23 的 DELETE)policy。
--   RLS 之下,前端送 update 會被「靜默擋掉」(0 rows、不報錯,重整後復原)。
--   本 migration 補上 UPDATE policy,讓客戶詳情頁的「活動紀錄」可以就地編輯內文。
--
-- 權限:沿用 comments_select / comments_delete 的同一存取規則 ——
--   案件負責人(deals.rm_id = auth.uid())或主管 / admin(public.can_access_deal)。
--   UPDATE policy 同時需要 USING(能不能改這列)與 WITH CHECK(改完是否仍合法)。
--
-- 安全:comments 掛有 audit trigger(AFTER INSERT OR UPDATE OR DELETE),
--   編輯前後值都會寫進 audit_log。本 migration 不更動 audit_log 的任何 policy。
-- ============================================================

drop policy if exists comments_update on public.comments;
create policy comments_update on public.comments for update to authenticated
  using (public.can_access_deal(deal_id))
  with check (public.can_access_deal(deal_id));
