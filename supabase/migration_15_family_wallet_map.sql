-- =============================================================================
-- migration_15_family_wallet_map.sql
-- =============================================================================
-- Migration 編號 : 15
--                 （上一個既有最大號 = migration_14_gnews_sources.sql，
--                   Phase 5.2-b 已佔用 14；依 CLAUDE.md「最大號 +1、衝突不
--                   回頭改名」，本檔取 15 — 對應 plan §0-A，Hugh 已拍板）
-- 對應 spec      : docs/family-wallet-map-spec.md  §3.1, §3.2
-- 對應 plan      : docs/family-wallet-map-implementation-plan.md  Session 2
--                 （Pre-flight A 編號、B idempotent 改寫，皆 Hugh 已批）
-- 執行方式      : Hugh 於 Supabase Dashboard → SQL Editor 手動貼上執行
--                 本專案無自動 migration 管道；Claude 不碰 Supabase。
-- 前置（Hugh 已確認）: 執行前已將 deals 表備份為 CSV。
-- -----------------------------------------------------------------------------
-- 對 spec 原文的調整（皆 Hugh 已批；僅改寫既有 statement，未新增/移除）：
--
-- [改寫 1] idempotent 化（plan §0-B；CLAUDE.md 規定 migration 須可重複執行）：
--   - ALTER TABLE deals ADD COLUMN ...            → ADD COLUMN IF NOT EXISTS
--   - CREATE INDEX idx_deals_wallet_map_review    → CREATE INDEX IF NOT EXISTS
--   - CREATE TRIGGER trigger_wallet_map_timestamp → 先 DROP TRIGGER IF EXISTS 再 CREATE
--   - CREATE TABLE wallet_map_audit_log           → CREATE TABLE IF NOT EXISTS
--   - CREATE INDEX idx_wallet_audit_deal_user     → CREATE INDEX IF NOT EXISTS
--   - CREATE POLICY（兩條）                        → 先 DROP POLICY IF EXISTS 再 CREATE
--   註：spec 的 update_wallet_map_timestamp() 原文已是 CREATE OR REPLACE
--       FUNCTION，本身即 idempotent，未改。
--
-- [改寫 2] wallet_map_audit_log.user_id 外鍵 schema：
--   spec 原文 REFERENCES auth.users(id)  →  REFERENCES public.profiles(id)
--   理由：Hugh 拍板，符合 repo 慣例（deals.rm_id → public.profiles）。
--   安全性：本 repo profiles.id == auth.uid()（見 schema.sql profiles_update_own
--           政策 id = auth.uid()），故 §3.2 的 RLS「auth.uid() = user_id」仍成立。
--
-- 段落 2B（Hugh 三項拍板，僅改寫既有 statement，未新增/移除）：
--   ① 全面加 public. schema 前綴：public.deals / public.profiles /
--      public.wallet_map_audit_log / public.can_access_deal() /
--      public.update_wallet_map_timestamp()。理由：repo 既有 12 個
--      migration 一律加 public.，此為事實上的慣例。
--   ② wallet_map_audit_log.deal_id 加 ON DELETE CASCADE，與其他 deal
--      子表（scores/comments/stage_history）一致；取捨：刪 deal 連帶
--      刪該 deal 的 audit log（Hugh 已接受）。
--   ③ wallet_map_audit_log.user_id 加 ON DELETE SET NULL（user_id 允許
--      NULL）；員工離職 profile 被刪時 audit 列保留、user_id 轉 NULL，
--      不擋 profile 刪除。
--
-- 除上述外，SQL 與 spec §3.1/§3.2 語意等價，未新增/移除任何 statement。
-- =============================================================================


-- ===== spec §3.1：deals 三個 wallet map 欄位 =====
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS family_wallet_map_md TEXT,
  ADD COLUMN IF NOT EXISTS family_wallet_map_last_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS family_wallet_map_updated_at TIMESTAMPTZ DEFAULT now();

-- spec §3.1："stale wallet maps" 查詢用部分索引
CREATE INDEX IF NOT EXISTS idx_deals_wallet_map_review
ON public.deals (family_wallet_map_last_reviewed_at)
WHERE family_wallet_map_md IS NOT NULL;

-- spec §3.1：wallet map 內容變更時自動更新 updated_at
-- （spec 原文已是 CREATE OR REPLACE FUNCTION，本身 idempotent，邏輯逐字保留；
--   2B① 函數名加 public. 前綴）
CREATE OR REPLACE FUNCTION public.update_wallet_map_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.family_wallet_map_md IS DISTINCT FROM OLD.family_wallet_map_md THEN
    NEW.family_wallet_map_updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- spec §3.1：trigger（idempotent 改寫 — 先 DROP IF EXISTS 再 CREATE；2B① public.）
DROP TRIGGER IF EXISTS trigger_wallet_map_timestamp ON public.deals;
CREATE TRIGGER trigger_wallet_map_timestamp
BEFORE UPDATE ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.update_wallet_map_timestamp();

-- spec §3.1：audit log 表
-- （idempotent — IF NOT EXISTS；2B① public. 前綴；
--   改寫2/2B③ user_id → public.profiles(id) ON DELETE SET NULL；
--   2B② deal_id → ON DELETE CASCADE）
CREATE TABLE IF NOT EXISTS public.wallet_map_audit_log (
  id BIGSERIAL PRIMARY KEY,
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT CHECK (action IN ('view', 'edit', 'mark_reviewed')),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_audit_deal_user
ON public.wallet_map_audit_log (deal_id, user_id, created_at DESC);


-- ===== spec §3.2：Row-Level Security =====
-- 重用既有 public.can_access_deal()（定義於 migration_8_teams.sql）；deals 表
-- 本身不需新政策（新欄位被既有 row 政策涵蓋，見 spec §3.2 / plan §0-C）。

-- 註：ENABLE ROW LEVEL SECURITY 重跑為無害 no-op，故未加 IF NOT EXISTS。
ALTER TABLE public.wallet_map_audit_log ENABLE ROW LEVEL SECURITY;

-- spec §3.2：使用者只能寫入自己的 audit 紀錄
-- （idempotent 改寫 — 先 DROP POLICY IF EXISTS 再 CREATE）
DROP POLICY IF EXISTS "audit_log_insert_own" ON public.wallet_map_audit_log;
CREATE POLICY "audit_log_insert_own"
ON public.wallet_map_audit_log FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- spec §3.2：使用者只能讀取自己有權限的 deal 的 audit 紀錄
-- （idempotent 改寫 — 先 DROP POLICY IF EXISTS 再 CREATE）
DROP POLICY IF EXISTS "audit_log_select_via_deal_access" ON public.wallet_map_audit_log;
CREATE POLICY "audit_log_select_via_deal_access"
ON public.wallet_map_audit_log FOR SELECT
USING (public.can_access_deal(deal_id));


-- =============================================================================
-- 回滾腳本（備用 — 不自動執行，全程以註解保存）
-- -----------------------------------------------------------------------------
-- ⚠️ 執行前必須（缺一不可）：
--   1) Hugh 明確指示要回滾。
--   2) 先在 Table Editor 確認 deals.family_wallet_map_md /
--      _last_reviewed_at / _updated_at 三欄「沒有任何資料」——
--      DROP COLUMN 會永久刪除該欄全部內容，不可復原。
--   3) 確認 wallet_map_audit_log 內資料可丟棄。
--
-- 要回滾時，Hugh 自行解除以下每行最前面的「-- 」、貼進 SQL Editor 執行。
-- 順序固定（先去相依物：trigger → function → table → columns）：
--
-- DROP TRIGGER IF EXISTS trigger_wallet_map_timestamp ON public.deals;
-- DROP FUNCTION IF EXISTS public.update_wallet_map_timestamp();
-- DROP TABLE IF EXISTS public.wallet_map_audit_log;   -- 兩條 policy 隨表一併消失
-- ALTER TABLE public.deals DROP COLUMN IF EXISTS family_wallet_map_md;
-- ALTER TABLE public.deals DROP COLUMN IF EXISTS family_wallet_map_last_reviewed_at;
-- ALTER TABLE public.deals DROP COLUMN IF EXISTS family_wallet_map_updated_at;
-- （idx_deals_wallet_map_review 隨對應欄位 DROP COLUMN 自動移除；
--   idx_wallet_audit_deal_user 隨 DROP TABLE 自動移除——無需單獨 DROP INDEX）
-- =============================================================================
