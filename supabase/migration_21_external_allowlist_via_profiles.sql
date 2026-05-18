-- migration_21_external_allowlist_via_profiles.sql
--
-- 需求(Hugh 2026-05-18):非 @wsgfo.com 的外部帳號,只要「admin 已在系統預建該
--   email 的 profile」即可登入。白名單即 profiles 表本身,admin 用現有 UI 自助管理。
--
-- 安全前提:此模型把信任邊界從「公司網域」移到「誰能建 profile」,故同時把
--   profiles_insert 收緊為「僅 is_admin()」(原本 admin OR team_lead)。
--   兩者必須一起套用,缺一不可(只改閘門不收緊權限 = team_lead 也能授予外部存取)。
--
-- 影響/注意:
--  • team_lead 以後不能在「新增成員」表單建 profile(只 admin 能);這是預期的行為變更。
--  • 撤銷外部帳號:刪 profile 只擋「未來新登入」;已 provision 進 auth.users 者仍能登入,
--    要徹底撤銷需刪該 auth.users 列(restrict_email_domain 只在 INSERT 時跑)。
--  • 套用後立即生效(prod DB trigger/policy)。需同步更新 docs/SECURITY.md 附錄 A。
--
-- Idempotent:create or replace / drop policy if exists。Rollback 見檔尾。

-- 1) 閘門:@wsgfo.com 或 已存在同 email profile 才放行
create or replace function public.restrict_email_domain() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.email is null then
    raise exception '此系統僅限 WORLDSUN 沃勝聯合家族辦公室 (@wsgfo.com) 員工,或經管理員預先建立帳號者使用。'
      using errcode = '42501';
  end if;

  -- 公司網域:自動放行
  if lower(new.email) ~ '@wsgfo\.com$' then
    return new;
  end if;

  -- 外部帳號:僅當系統已有該 email 的 profile(由 admin 在表單預建)才放行
  if exists (select 1 from public.profiles p where lower(p.email) = lower(new.email)) then
    return new;
  end if;

  raise exception '此系統僅限 WORLDSUN 沃勝聯合家族辦公室 (@wsgfo.com) 員工,或經管理員預先建立帳號者使用。您的 email % 未獲授權。', new.email
    using errcode = '42501';
end;
$$;

-- 2) 收緊 profiles 新增權限為「僅 admin」
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check ( public.is_admin() );

-- ============================================================================
-- ROLLBACK(還原為 migration_21 前狀態,整段執行即可)
-- ============================================================================
-- create or replace function public.restrict_email_domain() returns trigger
--   language plpgsql security definer set search_path = public as $$
-- begin
--   if new.email is null or new.email !~* '@wsgfo\.com$' then
--     raise exception '此系統僅限 WORLDSUN 沃勝聯合家族辦公室 (@wsgfo.com) 員工使用。您的 email % 未獲授權。', new.email
--       using errcode = '42501';
--   end if;
--   return new;
-- end;
-- $$;
--
-- drop policy if exists profiles_insert on public.profiles;
-- create policy profiles_insert on public.profiles
--   for insert to authenticated
--   with check ( is_admin() OR (is_team_lead() AND ((team_id = user_team_id()) OR (team_id IS NULL))) );
