-- migration_22_admin_ban_user.sql
--
-- 需求(Hugh 2026-05-18):admin(含本人)可在平台直接「軟撤銷」帳號 = ban
--   (立即禁止登入、帳號與資料保留、隨時可由 admin 復原)。不做硬刪除。
--
-- 做法:admin-only SECURITY DEFINER RPC(對齊既有 restore_deleted_deal 慣例:
--   auth.uid() IS NULL 時視為 SQL Editor 特權執行放行;否則須 is_admin())。
--   不需、也不放 service_role key 到前端。
--
-- 防呆(內建,不可關):非 admin 拒絕、不能停用自己、不能停用到剩 0 位有效 admin。
-- ban 同時清掉對方 auth.sessions(+ refresh_tokens,版本相容性以例外保護),即時踢出。
-- 每次 ban/unban 寫入 audit_log(table_name='auth.users',operation='BAN'/'UNBAN')。
--
-- 注意:ban 僅對「已存在 auth.users 的帳號」有效;從未登入過的 placeholder
--   無 auth 列,擋其登入請改用「移除 profile」(函式會回明確錯誤,不靜默)。
--
-- Idempotent:create or replace。Rollback 見檔尾。

-- ── 共用:解析 + 設定 ban 狀態 ───────────────────────────────────────────────
create or replace function public.admin_set_user_ban(p_email text, p_ban boolean)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id        uuid;
  v_role      text;
  v_name      text;
  v_prev      timestamptz;
  v_killed    int := 0;
  v_ban_until timestamptz := timestamptz '2099-12-31 00:00:00+00';
begin
  -- 權限閘門(SQL Editor 特權執行放行,對齊 restore_deleted_deal)
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'admin_set_user_ban: 僅限 admin';
  end if;

  if p_email is null or btrim(p_email) = '' then
    raise exception '請提供 email';
  end if;

  select u.id, u.banned_until, pr.role, pr.full_name
    into v_id, v_prev, v_role, v_name
  from auth.users u
  left join public.profiles pr on pr.id = u.id
  where lower(u.email) = lower(btrim(p_email))
  limit 1;

  if v_id is null then
    raise exception '找不到已登入過的帳號 %(若對方從未登入,沒有可停用的 auth 帳號;要擋其登入請改用「移除」)', p_email;
  end if;

  if p_ban then
    -- 不能停用自己(僅在由登入中的 admin 呼叫時判斷)
    if auth.uid() is not null and v_id = auth.uid() then
      raise exception '不能停用自己的帳號';
    end if;
    -- 不能停用到剩 0 位有效(未被 ban)admin
    if v_role = 'admin' and (
      select count(*) from public.profiles pr
      join auth.users au on au.id = pr.id
      where pr.role = 'admin' and pr.id <> v_id
        and (au.banned_until is null or au.banned_until < now())
    ) = 0 then
      raise exception '不能停用最後一位有效的 admin(會導致無人能管理系統)';
    end if;

    update auth.users set banned_until = v_ban_until where id = v_id;

    -- 即時踢出:清 session(+ refresh_tokens,欄位版本差異以例外吞掉不致命)
    delete from auth.sessions where user_id = v_id;
    get diagnostics v_killed = row_count;
    begin
      delete from auth.refresh_tokens where user_id = v_id::text;
    exception when others then
      begin delete from auth.refresh_tokens where user_id = v_id; exception when others then null; end;
    end;
  else
    update auth.users set banned_until = null where id = v_id;
  end if;

  -- audit_log.operation 受 CHECK 限定 INSERT/UPDATE/DELETE,
  -- 故 operation 用 'UPDATE',BAN/UNBAN 語意放 new_data.action
  insert into public.audit_log
    (table_name, record_id, operation, old_data, new_data, changed_by, changed_by_role, changed_by_name, changed_at)
  values
    ('auth.users', v_id::text, 'UPDATE',
     jsonb_build_object('email', lower(btrim(p_email)), 'prev_banned_until', v_prev),
     jsonb_build_object('action', case when p_ban then 'BAN' else 'UNBAN' end,
                        'banned', p_ban,
                        'banned_until', case when p_ban then v_ban_until else null end),
     auth.uid(),
     (select role from public.profiles where id = auth.uid()),
     (select full_name from public.profiles where id = auth.uid()),
     now());

  return jsonb_build_object(
    'email', lower(btrim(p_email)),
    'user_id', v_id,
    'action', case when p_ban then 'banned' else 'unbanned' end,
    'banned_until', case when p_ban then v_ban_until else null end,
    'sessions_killed', v_killed
  );
end;
$$;

-- ── 前端用的兩個明確包裝 ─────────────────────────────────────────────────────
create or replace function public.admin_ban_user(p_email text)
  returns jsonb language sql security definer set search_path = public as $$
  select public.admin_set_user_ban(p_email, true);
$$;

create or replace function public.admin_unban_user(p_email text)
  returns jsonb language sql security definer set search_path = public as $$
  select public.admin_set_user_ban(p_email, false);
$$;

-- ── UI 顯示用:每個 profile 的 auth/ban 狀態(前端讀不到 auth schema)─────────
create or replace function public.admin_member_status()
  returns table(id uuid, has_auth boolean, banned boolean)
  language sql security definer set search_path = public as $$
  select p.id,
         (u.id is not null) as has_auth,
         (u.banned_until is not null and u.banned_until > now()) as banned
  from public.profiles p
  left join auth.users u on u.id = p.id
  where public.is_admin();
$$;

grant execute on function public.admin_set_user_ban(text, boolean) to authenticated;
grant execute on function public.admin_ban_user(text)            to authenticated;
grant execute on function public.admin_unban_user(text)          to authenticated;
grant execute on function public.admin_member_status()           to authenticated;

-- ============================================================================
-- ROLLBACK(整段執行即移除本功能)
-- ============================================================================
-- drop function if exists public.admin_member_status();
-- drop function if exists public.admin_unban_user(text);
-- drop function if exists public.admin_ban_user(text);
-- drop function if exists public.admin_set_user_ban(text, boolean);
