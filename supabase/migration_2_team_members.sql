-- ============================================================
-- Migration 2 — 支援預建 RM / Admin + 自動合併
-- 執行此腳本後,管理員可以預先新增團隊成員(即使對方還沒登入),
-- 等對方第一次用 Google 登入時,系統會自動合併並轉移他的案件。
-- ============================================================

-- 1. 解除 profiles.id 與 auth.users.id 的外鍵 → 允許預建 profile
alter table public.profiles drop constraint if exists profiles_id_fkey;

-- 2. 為 email 加上唯一索引 (防止重複)
alter table public.profiles drop constraint if exists profiles_email_unique;
alter table public.profiles add constraint profiles_email_unique unique (email);

-- 3. 更新 handle_new_user trigger:登入時合併 placeholder
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  placeholder_role text;
begin
  -- 尋找同 email 的 placeholder profile 並捕捉其 role
  select role into placeholder_role
  from public.profiles
  where lower(email) = lower(new.email) and id != new.id
  limit 1;

  -- 轉移 deals
  update public.deals
    set rm_id = new.id
    where rm_id in (select id from public.profiles where lower(email) = lower(new.email) and id != new.id);
  update public.deals
    set created_by = new.id
    where created_by in (select id from public.profiles where lower(email) = lower(new.email) and id != new.id);

  -- 轉移 comments
  update public.comments
    set author_id = new.id
    where author_id in (select id from public.profiles where lower(email) = lower(new.email) and id != new.id);

  -- 轉移 stage_checklist
  update public.stage_checklist
    set checked_by = new.id
    where checked_by in (select id from public.profiles where lower(email) = lower(new.email) and id != new.id);

  -- 轉移 stage_history
  update public.stage_history
    set changed_by = new.id
    where changed_by in (select id from public.profiles where lower(email) = lower(new.email) and id != new.id);

  -- 刪除 placeholder
  delete from public.profiles where lower(email) = lower(new.email) and id != new.id;

  -- 建立真正的 profile (繼承 placeholder 的 role,沒有就預設 rm)
  insert into public.profiles (id, email, full_name, rm_code, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(placeholder_role, 'rm')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- 4. 新增 INSERT / DELETE policies:讓管理員能新增/移除 placeholder
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check (public.is_manager());

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles for delete to authenticated
  using (public.is_manager() and id != auth.uid());  -- 不能自刪

-- ============================================================
-- 預建 3 位新成員(Hugh 會在 UI 裡看到他們,可以把 deal 指派給他們)
-- 等對方首次用 Google 登入,placeholder 會自動合併 + 轉移所有 deal
-- ============================================================

insert into public.profiles (id, email, full_name, rm_code, role) values
  (gen_random_uuid(), 'abbiewu@wsgfo.com',   'Abbie Wu',   'Abbie', 'manager'),
  (gen_random_uuid(), 'zoechiang@wsgfo.com', 'Zoe Chiang', 'Zoe',   'manager'),
  (gen_random_uuid(), 'davie@wsgfo.com',     'Davie',      'Davie', 'rm')
on conflict (email) do update set
  full_name = excluded.full_name,
  rm_code   = excluded.rm_code,
  role      = excluded.role;

-- 5. 把 profiles 加入 Realtime 發布(讓新增團隊成員時即時同步)
alter publication supabase_realtime add table public.profiles;
