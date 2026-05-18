-- migration_19_fix_handle_new_user_order.sql
--
-- 問題:預建 placeholder profile 名下若已有案子,該同事用 Google 首次登入會
--       500「Database error saving new user」,被無限打回登入頁。
--       (實證:simonshone@wsgfo.com,auth log 2026-05-18 08:00:02,
--        ERROR deals_rm_id_fkey 23503 → 交易回滾 25P02)
--
-- 真因:migration_2 的 handle_new_user() 在「建立新 profile 之前」就先
--       UPDATE deals.rm_id = new.id。deals.rm_id 外鍵指向 profiles.id,
--       新 id 此刻尚未存在於 profiles → 外鍵違反 → 整筆 auth 寫入回滾。
--
-- 修法:正確順序 = 讓開 placeholder 的 unique email → 先建立新 profile
--       → 轉移「全部 14 條」指向 placeholder 的外鍵參照 → 最後刪 placeholder。
--       (只轉移部分參照會把同一類 bug 搬到別張表,故一次涵蓋全部。)
--
-- Idempotent:create or replace,可重複執行。
-- 套用後驗證:讓 simonshone 重新用 Google 登入一次即可;
--            事後檢查 auth.users 應出現該帳號、deal L_01 的 rm_id 應為其新 uid、
--            placeholder f0475e9c… 應已消失。

create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  ph_id   uuid;
  ph_role text;
begin
  -- 找同 email 的 placeholder(id 不同者)
  select id, role into ph_id, ph_role
  from public.profiles
  where lower(email) = lower(new.email) and id <> new.id
  limit 1;

  if ph_id is not null then
    -- 1. 先讓開 placeholder 佔用的 unique email,
    --    否則新 profile 會因 profiles_email_unique 無法插入
    update public.profiles
      set email = 'migrated-' || ph_id::text || '@placeholder.invalid'
      where id = ph_id;

    -- 2. 建立真正的 profile(繼承 placeholder 的 role,沒有則預設 rm)
    insert into public.profiles (id, email, full_name, rm_code, role)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email),
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      coalesce(ph_role, 'rm')
    )
    on conflict (id) do nothing;

    -- 3. 此時 new.id 的 profile 已存在,轉移所有指向 placeholder 的外鍵參照
    --    (涵蓋全部 14 條 FK → profiles.id,確保第 4 步刪除不再撞外鍵)
    update public.deals                set rm_id       = new.id where rm_id       = ph_id;
    update public.deals                set created_by  = new.id where created_by  = ph_id;
    update public.comments             set author_id   = new.id where author_id   = ph_id;
    update public.stage_checklist      set checked_by  = new.id where checked_by  = ph_id;
    update public.stage_history        set changed_by  = new.id where changed_by  = ph_id;
    update public.deal_questions       set asked_by    = new.id where asked_by    = ph_id;
    update public.pain_points          set created_by  = new.id where created_by  = ph_id;
    update public.tasks                set assignee_id = new.id where assignee_id = ph_id;
    update public.tasks                set created_by  = new.id where created_by  = ph_id;
    update public.deal_attachments     set uploaded_by = new.id where uploaded_by = ph_id;
    update public.ingest_sources       set created_by  = new.id where created_by  = ph_id;
    update public.market_intel         set created_by  = new.id where created_by  = ph_id;
    update public.intel_deal_links     set linked_by   = new.id where linked_by   = ph_id;
    update public.intel_link_suggestions set decided_by = new.id where decided_by = ph_id;

    -- 4. placeholder 已無任何參照,安全刪除
    delete from public.profiles where id = ph_id;
  else
    -- 沒有 placeholder:正常建立新 profile
    insert into public.profiles (id, email, full_name, rm_code, role)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email),
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      'rm'
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

-- ============================================================================
-- ROLLBACK(如需還原為修補前版本,執行以下整段即可)
-- ============================================================================
-- create or replace function public.handle_new_user() returns trigger
--   language plpgsql security definer set search_path = public as $$
-- declare
--   placeholder_role text;
-- begin
--   select role into placeholder_role
--   from public.profiles
--   where lower(email) = lower(new.email) and id != new.id
--   limit 1;
--   update public.deals set rm_id = new.id
--     where rm_id in (select id from public.profiles where lower(email) = lower(new.email) and id != new.id);
--   update public.deals set created_by = new.id
--     where created_by in (select id from public.profiles where lower(email) = lower(new.email) and id != new.id);
--   update public.comments set author_id = new.id
--     where author_id in (select id from public.profiles where lower(email) = lower(new.email) and id != new.id);
--   update public.stage_checklist set checked_by = new.id
--     where checked_by in (select id from public.profiles where lower(email) = lower(new.email) and id != new.id);
--   update public.stage_history set changed_by = new.id
--     where changed_by in (select id from public.profiles where lower(email) = lower(new.email) and id != new.id);
--   delete from public.profiles where lower(email) = lower(new.email) and id != new.id;
--   insert into public.profiles (id, email, full_name, rm_code, role)
--   values (
--     new.id, new.email,
--     coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email),
--     coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
--     coalesce(placeholder_role, 'rm')
--   )
--   on conflict (id) do nothing;
--   return new;
-- end;
-- $$;
