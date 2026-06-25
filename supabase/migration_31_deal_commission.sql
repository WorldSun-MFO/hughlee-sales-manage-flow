-- ============================================================
-- Migration 31 — deals 加 company_commission / sales_commission(公司收佣 / 業務收佣)
-- ============================================================
-- 用途:成交日確認頁 / 客戶詳情頁顯示與編輯兩種佣金金額(USD,與 aum_usd 同單位)。
--
-- 權限(欄位級,RLS 是 row-level 擋不住「誰能改哪個欄位」,故用 trigger 補):
--   公司收佣 company_commission：只有 admin 可看 / 改
--   業務收佣 sales_commission ：只有 admin 或「該 deal 的 RM 本人」可看 / 改
--
--   「看見」由前端資料層(data.ts maskCommission)依角色把欄位值 null 掉,
--    未授權者根本拿不到值;「修改」由下方 trigger 在 DB 端強制。
--
-- Realtime / Audit:deals 已在 publication、audit trigger 擷取整列,自動含新欄。
-- ============================================================
alter table public.deals
  add column if not exists company_commission numeric,
  add column if not exists sales_commission   numeric;

-- 欄位級寫入保護 -----------------------------------------------
create or replace function public.guard_deal_commission_write()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- 公司收佣:只有 admin 能改
  if new.company_commission is distinct from old.company_commission
     and not public.is_admin() then
    raise exception '只有管理員可以修改公司收佣';
  end if;

  -- 業務收佣:只有 admin 或該 deal 原本的 RM 本人能改
  if new.sales_commission is distinct from old.sales_commission
     and not (public.is_admin() or old.rm_id = auth.uid()) then
    raise exception '只有管理員或該業務本人可以修改業務收佣';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_deal_commission_write on public.deals;
create trigger trg_guard_deal_commission_write
  before update on public.deals
  for each row execute function public.guard_deal_commission_write();
