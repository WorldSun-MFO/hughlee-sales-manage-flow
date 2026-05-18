-- migration_20_handle_new_user_carry_team.sql
--
-- 接續 migration_19。問題:預建 placeholder 有指派 team_id,但 handle_new_user()
--   建立真實 profile 時只繼承 role,未帶 team_id → 同事首次登入後 team_id 變 null,
--   三層權限的 team_lead/admin 團隊視圖看不到該同事。
--   (simon 已用單筆 UPDATE 手動補回 WS Team;此 migration 讓 vestawang 與未來
--    所有預建同事首次登入自動帶 team_id,不需再手動補。)
--
-- 範圍:僅在「placeholder 分支」的 insert 多帶一欄 team_id = placeholder 的 team_id。
--   rm_code / full_name 仍走真人 Google 名(刻意維持:rm_code 為顯示鏡射、
--   非邏輯 key,真人名比 placeholder 暫名正確)。其餘順序邏輯與 migration_19 完全相同。
--
-- Idempotent:create or replace。Rollback：見檔尾，貼回即還原為 migration_19 版本。

create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  ph_id      uuid;
  ph_role    text;
  ph_team_id uuid;
begin
  select id, role, team_id into ph_id, ph_role, ph_team_id
  from public.profiles
  where lower(email) = lower(new.email) and id <> new.id
  limit 1;

  if ph_id is not null then
    update public.profiles
      set email = 'migrated-' || ph_id::text || '@placeholder.invalid'
      where id = ph_id;

    insert into public.profiles (id, email, full_name, rm_code, role, team_id)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email),
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      coalesce(ph_role, 'rm'),
      ph_team_id
    )
    on conflict (id) do nothing;

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

    delete from public.profiles where id = ph_id;
  else
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
-- ROLLBACK(還原為 migration_19 版本：移除 team_id 繼承)
-- ============================================================================
-- 重新貼上 migration_19_fix_handle_new_user_order.sql 的 create or replace 區塊即可。
