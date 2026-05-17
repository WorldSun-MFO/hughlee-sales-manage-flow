-- ============================================================================
-- Migration 17: 一鍵還原誤刪案件工具(免手拆 audit_log JSONB)
-- ============================================================================
--
-- 背景:SECURITY.md §6.1 決定不做軟刪除,誤刪靠 audit_log 還原;但 §4.6 的
--       還原是「人工拆 JSONB 拼 INSERT」,RM 不可能自助,admin 也容易出錯。
--       migration_16 已把 audit 安全網修好(deals + 6 子表 DELETE 都有記)。
--       本 migration 提供兩支函數,把還原變成一行指令:
--
--   1. public.list_deleted_deals(p_days int default 30)
--        → 列出近 N 天被刪、目前不存在於 deals 的案件(可還原清單)
--   2. public.restore_deleted_deal(p_deal_id uuid)
--        → 從 audit_log 自動重建該案件 + 其級聯子資料,回傳還原摘要 jsonb
--
-- 安全:
--   - 兩支皆 SECURITY DEFINER + SET search_path = public(CLAUDE.md 必讀第3點)。
--   - 權限閘門:有登入身分(auth.uid() 非 NULL)時必須是 admin;
--     auth.uid() 為 NULL 代表在 Supabase SQL Editor 以特權角色執行 → 放行
--     (該情境本來就是 DB 管理者,且這是你的驗收邊界)。
--   - 還原本身會觸發 *_audit INSERT → 還原動作也進不可篡改 audit_log,可追溯。
--   - restore 全程在單一函數內 = 原子;任何一步失敗整筆 rollback,不留半套。
--
-- 還原範圍(誠實邊界):
--   ✅ deals 本體 + scores / score_notes / stage_checklist / deal_questions /
--      comments / tasks(該 deal 的)—— 前提:刪除當下這些表 audit trigger 有效。
--   ⚠️ 在 migration_16 修好「之前」就被刪的案件(例如測試案件「517」,
--      2026-05-17 11:41 刪),其 scores 等子資料當時沒被 audit 抓到 →
--      只會還原 deals 殼 + 當時有抓到的部分;函數回傳摘要會逐表標明 0 筆。
--   ❌ stage_history / deal_attachments / 市場情報連結 / family_wallet_map
--      不在 10 張 audited 表內,無法由本工具還原(設計上接受,見 SECURITY.md §4.4)。
--
-- 執行:沿用 migration 15/16 流程 —— SQL Editor 貼上,先 BEGIN;…ROLLBACK; dry-run,
--       無誤再 BEGIN;…COMMIT;。本檔只建函數,不改資料,風險低。
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. list_deleted_deals:可還原清單
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_deleted_deals(p_days int DEFAULT 30)
RETURNS TABLE (
  deal_id        uuid,
  deal_name      text,
  rm_name        text,
  deleted_at     timestamptz,
  deleted_by     text,
  child_rows     bigint   -- 該次刪除事件連帶被 audit 抓到的子資料筆數
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'list_deleted_deals: 僅限 admin';
  END IF;

  RETURN QUERY
  WITH del AS (
    SELECT DISTINCT ON ((a.old_data->>'id'))
      (a.old_data->>'id')::uuid          AS d_id,
      a.old_data->>'name'                AS d_name,
      a.changed_by_name                  AS by_name,
      a.changed_at                       AS at_time
    FROM public.audit_log a
    WHERE a.table_name = 'deals'
      AND a.operation  = 'DELETE'
      AND a.changed_at > now() - make_interval(days => p_days)
    ORDER BY (a.old_data->>'id'), a.changed_at DESC
  )
  SELECT
    del.d_id,
    del.d_name,
    del.by_name,            -- 註:此為刪除當下記錄的操作者全名
    del.at_time,
    del.by_name,
    (SELECT count(*) FROM public.audit_log c
       WHERE c.operation = 'DELETE'
         AND c.changed_at BETWEEN del.at_time - interval '5 seconds'
                              AND del.at_time + interval '5 seconds'
         AND (c.old_data->>'deal_id') = del.d_id::text)
  FROM del
  WHERE NOT EXISTS (SELECT 1 FROM public.deals dl WHERE dl.id = del.d_id)
  ORDER BY del.at_time DESC;
END;
$$;


-- ----------------------------------------------------------------------------
-- 2. restore_deleted_deal:一鍵還原案件 + 級聯子資料
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_deleted_deal(p_deal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deal_audit   public.audit_log%ROWTYPE;
  v_t            timestamptz;
  v_summary      jsonb := '{}'::jsonb;
  v_n            bigint;
BEGIN
  -- 權限閘門(SQL Editor 特權執行放行)
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'restore_deleted_deal: 僅限 admin';
  END IF;

  -- 拒絕覆蓋現存案件
  IF EXISTS (SELECT 1 FROM public.deals WHERE id = p_deal_id) THEN
    RAISE EXCEPTION '案件 % 目前仍存在,不還原(避免覆蓋現有資料)', p_deal_id;
  END IF;

  -- 找最近一次該案件的 DELETE 事件
  SELECT * INTO v_deal_audit
  FROM public.audit_log
  WHERE table_name = 'deals' AND operation = 'DELETE'
    AND (old_data->>'id') = p_deal_id::text
  ORDER BY changed_at DESC
  LIMIT 1;

  IF v_deal_audit.id IS NULL THEN
    RAISE EXCEPTION 'audit_log 找不到案件 % 的刪除紀錄(可能從未被刪,或已超出 audit 範圍)', p_deal_id;
  END IF;

  v_t := v_deal_audit.changed_at;

  -- (a) 還原 deals 本體(jsonb_populate_record 對 schema 異動自適應)
  INSERT INTO public.deals
  SELECT * FROM jsonb_populate_record(NULL::public.deals, v_deal_audit.old_data);
  -- 註:此 INSERT 會觸發 deals 的自動建空白 scores 列 trigger,
  --     故下面 scores 用 UPSERT 覆蓋。

  -- 子資料:取同一刪除事件(±5 秒同交易)被 audit 抓到的 DELETE 列,
  --        每個 record 取最新一筆,jsonb_populate_record 還原。

  -- (b) scores —— UPSERT(蓋掉 deal-insert trigger 自動建的空白列)
  WITH s AS (
    SELECT DISTINCT ON (record_id) old_data
    FROM public.audit_log
    WHERE table_name='scores' AND operation='DELETE'
      AND (old_data->>'deal_id') = p_deal_id::text
      AND changed_at BETWEEN v_t - interval '5 seconds' AND v_t + interval '5 seconds'
    ORDER BY record_id, changed_at DESC
  ), ins AS (
    INSERT INTO public.scores
    SELECT (jsonb_populate_record(NULL::public.scores, s.old_data)).*
    FROM s
    ON CONFLICT (deal_id) DO UPDATE SET
      m=EXCLUDED.m, e=EXCLUDED.e, d1=EXCLUDED.d1, d2=EXCLUDED.d2,
      p=EXCLUDED.p, i=EXCLUDED.i, c1=EXCLUDED.c1, c2=EXCLUDED.c2,
      updated_at=EXCLUDED.updated_at
    RETURNING 1
  )
  SELECT count(*) INTO v_n FROM ins;
  v_summary := v_summary || jsonb_build_object('scores', v_n);

  -- (c) score_notes
  WITH x AS (
    SELECT DISTINCT ON (record_id) old_data
    FROM public.audit_log
    WHERE table_name='score_notes' AND operation='DELETE'
      AND (old_data->>'deal_id') = p_deal_id::text
      AND changed_at BETWEEN v_t - interval '5 seconds' AND v_t + interval '5 seconds'
    ORDER BY record_id, changed_at DESC
  ), ins AS (
    INSERT INTO public.score_notes
    SELECT (jsonb_populate_record(NULL::public.score_notes, x.old_data)).*
    FROM x ON CONFLICT DO NOTHING RETURNING 1
  )
  SELECT count(*) INTO v_n FROM ins;
  v_summary := v_summary || jsonb_build_object('score_notes', v_n);

  -- (d) stage_checklist
  WITH x AS (
    SELECT DISTINCT ON (record_id) old_data
    FROM public.audit_log
    WHERE table_name='stage_checklist' AND operation='DELETE'
      AND (old_data->>'deal_id') = p_deal_id::text
      AND changed_at BETWEEN v_t - interval '5 seconds' AND v_t + interval '5 seconds'
    ORDER BY record_id, changed_at DESC
  ), ins AS (
    INSERT INTO public.stage_checklist
    SELECT (jsonb_populate_record(NULL::public.stage_checklist, x.old_data)).*
    FROM x ON CONFLICT DO NOTHING RETURNING 1
  )
  SELECT count(*) INTO v_n FROM ins;
  v_summary := v_summary || jsonb_build_object('stage_checklist', v_n);

  -- (e) deal_questions
  WITH x AS (
    SELECT DISTINCT ON (record_id) old_data
    FROM public.audit_log
    WHERE table_name='deal_questions' AND operation='DELETE'
      AND (old_data->>'deal_id') = p_deal_id::text
      AND changed_at BETWEEN v_t - interval '5 seconds' AND v_t + interval '5 seconds'
    ORDER BY record_id, changed_at DESC
  ), ins AS (
    INSERT INTO public.deal_questions
    SELECT (jsonb_populate_record(NULL::public.deal_questions, x.old_data)).*
    FROM x ON CONFLICT DO NOTHING RETURNING 1
  )
  SELECT count(*) INTO v_n FROM ins;
  v_summary := v_summary || jsonb_build_object('deal_questions', v_n);

  -- (f) comments(自身 id 主鍵)
  WITH x AS (
    SELECT DISTINCT ON (record_id) old_data
    FROM public.audit_log
    WHERE table_name='comments' AND operation='DELETE'
      AND (old_data->>'deal_id') = p_deal_id::text
      AND changed_at BETWEEN v_t - interval '5 seconds' AND v_t + interval '5 seconds'
    ORDER BY record_id, changed_at DESC
  ), ins AS (
    INSERT INTO public.comments
    SELECT (jsonb_populate_record(NULL::public.comments, x.old_data)).*
    FROM x ON CONFLICT DO NOTHING RETURNING 1
  )
  SELECT count(*) INTO v_n FROM ins;
  v_summary := v_summary || jsonb_build_object('comments', v_n);

  -- (g) tasks(該 deal 的;獨立任務 deal_id 為 NULL 不在此列)
  WITH x AS (
    SELECT DISTINCT ON (record_id) old_data
    FROM public.audit_log
    WHERE table_name='tasks' AND operation='DELETE'
      AND (old_data->>'deal_id') = p_deal_id::text
      AND changed_at BETWEEN v_t - interval '5 seconds' AND v_t + interval '5 seconds'
    ORDER BY record_id, changed_at DESC
  ), ins AS (
    INSERT INTO public.tasks
    SELECT (jsonb_populate_record(NULL::public.tasks, x.old_data)).*
    FROM x ON CONFLICT DO NOTHING RETURNING 1
  )
  SELECT count(*) INTO v_n FROM ins;
  v_summary := v_summary || jsonb_build_object('tasks', v_n);

  RETURN jsonb_build_object(
    'restored_deal_id', p_deal_id,
    'deal_name',        v_deal_audit.old_data->>'name',
    'deleted_at',       v_t,
    'children',         v_summary,
    'note',             '還原動作已記入 audit_log;stage_history/附件/市場情報連結不在還原範圍'
  );
END;
$$;


-- ============================================================================
-- 用法 / 驗證(real-run 後)
-- ============================================================================
-- 1) 看可還原清單:
--    SELECT * FROM public.list_deleted_deals();        -- 近 30 天
--    SELECT * FROM public.list_deleted_deals(90);      -- 近 90 天
--
-- 2) 還原指定案件(從上面清單複製 deal_id):
--    SELECT public.restore_deleted_deal('00000000-0000-0000-0000-000000000000');
--    → 回傳 jsonb 摘要:各子表還原筆數。
--
-- 3) 「517」測試案件 end-to-end 驗證(它在 migration_16 前被刪,屬部分還原):
--    BEGIN;
--      SELECT public.restore_deleted_deal(
--        (SELECT (old_data->>'id')::uuid FROM public.audit_log
--         WHERE table_name='deals' AND operation='DELETE'
--           AND old_data->>'name'='517' ORDER BY changed_at DESC LIMIT 1)
--      );
--      SELECT id, name, stage, rm_id FROM public.deals WHERE name='517';  -- 殼回來了
--    ROLLBACK;  -- 測完不留(517 是測試案件);要正式留下就改 COMMIT;
-- ============================================================================
