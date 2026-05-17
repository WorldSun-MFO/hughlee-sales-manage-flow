-- ============================================================================
-- Migration 16: 修復 audit_trigger_func() 的 record_id bug + 補回 4 個被 DROP 的 trigger
-- ============================================================================
--
-- 背景(2026-05-17):
--   audit_trigger_func() 的 record_id 寫死 NEW.id / OLD.id。但 10 張被監控的表中,
--   有 4 張沒有 id 欄(主鍵是 deal_id 或複合鍵):
--     - scores            PK = deal_id
--     - score_notes        PK = (deal_id, field)
--     - stage_checklist    PK = (deal_id, item_key)
--     - deal_questions     PK = (deal_id, question_key)
--   這 4 張表任何 INSERT/UPDATE/DELETE 都會讓 AFTER trigger 報
--   `record "new" has no field "id"` → 交易回滾 → 寫入全面癱瘓。
--   今天為了讓同事能繼續打分,已緊急 DROP 這 4 張表的 *_audit trigger。
--   後果:這 4 張表目前「零變更追溯」,且案件被刪時其 MEDDIC 評分/備註/
--   檢查清單/Discovery 問題不會進 audit_log → 誤刪只能「半救」。
--
-- 本 migration 做兩件事:
--   1. CREATE OR REPLACE audit_trigger_func():改用「通用 record_id」推導,
--      不再假設有 id 欄(對複合鍵以 ':' 串接)。對既有 6 張有 id 的表
--      行為完全不變(COALESCE 先取 id),對 4 張無 id 的表則正確運作。
--   2. 以 DROP IF EXISTS + CREATE 重建全部 10 張表的 *_audit trigger,
--      確保最終狀態固定為 30 個 trigger(idempotent、可重跑)。
--
-- 慣例:全程 idempotent;保留 SECURITY DEFINER + SET search_path = public
--      (CLAUDE.md「資料安全(必讀)」第 3 點要求)。
--
-- 執行方式(沿用 migration 15 已驗證流程):
--   Step 1  整段貼進 Supabase SQL Editor,但「先不要按 Run」,改在最前面包
--           BEGIN;  …  最後用 ROLLBACK;  做 dry-run,看有沒有報錯。
--   Step 2  dry-run 無誤 → 改成 BEGIN; … COMMIT; real-run。
--   Step 3  跑檔尾「驗證 SQL」,trigger_count 必須 = 30。
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. 修復後的 trigger function(通用 record_id,永不因缺欄報錯)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID;
  v_user_role TEXT;
  v_user_name TEXT;
  v_rec       JSONB;   -- 受影響列的完整 JSONB(DELETE 取 OLD,其餘取 NEW)
  v_record_id TEXT;    -- 通用主鍵字串,不假設欄名叫 id
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NOT NULL THEN
    SELECT role, full_name INTO v_user_role, v_user_name
    FROM public.profiles
    WHERE id = v_user_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_rec := to_jsonb(OLD);
  ELSE
    v_rec := to_jsonb(NEW);
  END IF;

  -- 通用 record_id:
  --   有 id 欄(deals/comments/tasks/profiles/settings/pain_points)→ 取 id,
  --     與舊版 NEW.id::TEXT 完全等價,既有 6 張表行為不變。
  --   無 id 欄(scores/score_notes/stage_checklist/deal_questions)→ 以
  --     deal_id + 次要鍵用 ':' 串接(concat_ws 自動略過 NULL),唯一且不報錯。
  --   ->>'x' 對不存在的 key 回傳 NULL(永不丟例外),這是本修復的關鍵。
  v_record_id := COALESCE(
    v_rec->>'id',
    NULLIF(
      concat_ws(':',
        v_rec->>'deal_id',
        v_rec->>'field',
        v_rec->>'item_key',
        v_rec->>'question_key'
      ),
      ''
    )
  );

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (
      table_name, record_id, operation,
      new_data, changed_by, changed_by_role, changed_by_name
    ) VALUES (
      TG_TABLE_NAME, v_record_id, TG_OP,
      v_rec, v_user_id, v_user_role, v_user_name
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF to_jsonb(OLD) IS DISTINCT FROM to_jsonb(NEW) THEN
      INSERT INTO public.audit_log (
        table_name, record_id, operation,
        old_data, new_data, changed_by, changed_by_role, changed_by_name
      ) VALUES (
        TG_TABLE_NAME, v_record_id, TG_OP,
        to_jsonb(OLD), v_rec, v_user_id, v_user_role, v_user_name
      );
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (
      table_name, record_id, operation,
      old_data, changed_by, changed_by_role, changed_by_name
    ) VALUES (
      TG_TABLE_NAME, v_record_id, TG_OP,
      v_rec, v_user_id, v_user_role, v_user_name
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;


-- ----------------------------------------------------------------------------
-- 2. 重建全部 10 張表的 *_audit trigger(DROP IF EXISTS + CREATE,可重跑)
--    最終狀態固定 = 10 表 × 3 ops = 30 個 trigger。
-- ----------------------------------------------------------------------------

-- 既有存活的 6 張(重建為安全的 no-op,確保與修復後函數綁定一致)
DROP TRIGGER IF EXISTS deals_audit        ON public.deals;
CREATE TRIGGER deals_audit        AFTER INSERT OR UPDATE OR DELETE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS comments_audit     ON public.comments;
CREATE TRIGGER comments_audit     AFTER INSERT OR UPDATE OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS tasks_audit        ON public.tasks;
CREATE TRIGGER tasks_audit        AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS profiles_audit     ON public.profiles;
CREATE TRIGGER profiles_audit     AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS settings_audit     ON public.settings;
CREATE TRIGGER settings_audit     AFTER INSERT OR UPDATE OR DELETE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS pain_points_audit  ON public.pain_points;
CREATE TRIGGER pain_points_audit  AFTER INSERT OR UPDATE OR DELETE ON public.pain_points
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- 今天被 DROP、本 migration 補回的 4 張(修復後可正常運作)
DROP TRIGGER IF EXISTS scores_audit          ON public.scores;
CREATE TRIGGER scores_audit          AFTER INSERT OR UPDATE OR DELETE ON public.scores
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS score_notes_audit     ON public.score_notes;
CREATE TRIGGER score_notes_audit     AFTER INSERT OR UPDATE OR DELETE ON public.score_notes
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS stage_checklist_audit ON public.stage_checklist;
CREATE TRIGGER stage_checklist_audit AFTER INSERT OR UPDATE OR DELETE ON public.stage_checklist
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS deal_questions_audit  ON public.deal_questions;
CREATE TRIGGER deal_questions_audit  AFTER INSERT OR UPDATE OR DELETE ON public.deal_questions
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();


-- ============================================================================
-- 驗證 SQL(real-run 後務必跑;對應 docs/SECURITY.md 附錄 B)
-- ============================================================================
-- (a) trigger 總數必須 = 30
--   SELECT count(*) AS trigger_count
--   FROM information_schema.triggers
--   WHERE trigger_schema='public' AND trigger_name LIKE '%_audit';
--
-- (b) 逐表確認 10 張都在、每張 3 ops
--   SELECT event_object_table AS tbl, string_agg(DISTINCT event_manipulation, ',') AS ops
--   FROM information_schema.triggers
--   WHERE trigger_schema='public' AND trigger_name LIKE '%_audit'
--   GROUP BY event_object_table ORDER BY tbl;
--   期望 10 列:comments/deal_questions/deals/pain_points/profiles/
--               score_notes/scores/settings/stage_checklist/tasks
--
-- (c) 端對端冒煙測試(在交易內做,測完 ROLLBACK 不留痕):
--   BEGIN;
--     UPDATE public.scores SET m = m WHERE deal_id IN (SELECT id FROM public.deals LIMIT 1);
--     SELECT table_name, operation, record_id, changed_at
--     FROM public.audit_log WHERE table_name='scores' ORDER BY changed_at DESC LIMIT 1;
--     -- 應看到一筆 scores / UPDATE,record_id = 該 deal 的 UUID
--   ROLLBACK;
--
-- (d) 附錄 B.2 紅旗檢查 4 條,全部期望 0 行 / 設定不變。
-- ============================================================================
