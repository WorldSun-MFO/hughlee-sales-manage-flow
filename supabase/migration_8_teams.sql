-- ============================================================
-- Migration 8 — 三層權限(Admin / Team Lead / RM) + 團隊概念
-- ============================================================
-- 業務組分(WS Team / Daniel Team / Eason Team),之後可加區域團隊。
-- Admin 看全部、Team Lead 看自己團隊、RM 只看自己。
-- ============================================================

-- 1) Teams 表 -------------------------------------------------
create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

alter table public.teams enable row level security;

-- 所有登入者可讀 team 名稱(下拉選單用)
drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams for select to authenticated using (true);

-- 之後改成 admin only(等下面 is_admin() 建好再切回來)
drop policy if exists teams_write on public.teams;
create policy teams_write on public.teams for all to authenticated
  using (exists(select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists(select 1 from public.profiles where id = auth.uid() and role = 'admin'));

do $$ begin
  alter publication supabase_realtime add table public.teams;
exception when duplicate_object then null;
end $$;

-- 2) Profiles 加 team_id + 擴充 role ---------------------------
alter table public.profiles
  add column if not exists team_id uuid references public.teams(id) on delete set null;

-- 先 drop 舊 constraint(允許舊 'manager' 暫時存在)
alter table public.profiles drop constraint if exists profiles_role_check;

-- 3) Migrate 既有 'manager' --------------------------------------
-- Hugh → admin、其他 manager → team_lead
update public.profiles set role = 'admin'
  where email = 'hughlee@wsgfo.com';

update public.profiles set role = 'team_lead'
  where role = 'manager';

-- 確認沒有殘留的 'manager' 後,再加 constraint
alter table public.profiles add constraint profiles_role_check
  check (role in ('rm', 'team_lead', 'admin'));

-- 4) 建立三個團隊 + 把現有 4 個人分進 WS Team --------------------
insert into public.teams (name) values
  ('WS Team'), ('Daniel Team'), ('Eason Team')
on conflict (name) do nothing;

update public.profiles
  set team_id = (select id from public.teams where name = 'WS Team')
  where email in ('hughlee@wsgfo.com', 'abbiewu@wsgfo.com', 'zoechiang@wsgfo.com', 'davie@wsgfo.com');

-- 5) 新權限 helper ---------------------------------------------
create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_team_lead() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'team_lead');
$$;

create or replace function public.user_team_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select team_id from public.profiles where id = auth.uid();
$$;

-- Helper:這個 deal 我能否存取?(整套權限邏輯封裝)
create or replace function public.can_access_deal(p_deal_id uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.deals d
    where d.id = p_deal_id
      and (
        d.rm_id = auth.uid()                                      -- 自己的 deal
        or public.is_admin()                                      -- admin 看全部
        or (
          public.is_team_lead()                                   -- team lead
          and public.user_team_id() is not null
          and exists (
            select 1 from public.profiles p
            where p.id = d.rm_id and p.team_id = public.user_team_id()
          )
        )
      )
  );
$$;

-- 為向後相容,保留 is_manager() 別名,語意改為「admin 或 team_lead」
create or replace function public.is_manager() returns boolean
  language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.is_team_lead();
$$;

-- 6) 重寫 deals RLS(三層權限)-------------------------------
drop policy if exists deals_select on public.deals;
create policy deals_select on public.deals for select to authenticated
  using (
    rm_id = auth.uid()
    or public.is_admin()
    or (
      public.is_team_lead()
      and public.user_team_id() is not null
      and exists (
        select 1 from public.profiles p
        where p.id = deals.rm_id and p.team_id = public.user_team_id()
      )
    )
  );

drop policy if exists deals_insert on public.deals;
create policy deals_insert on public.deals for insert to authenticated
  with check (
    rm_id = auth.uid()
    or public.is_admin()
    or (
      public.is_team_lead()
      and public.user_team_id() is not null
      and exists (
        select 1 from public.profiles p
        where p.id = deals.rm_id and p.team_id = public.user_team_id()
      )
    )
  );

drop policy if exists deals_update on public.deals;
create policy deals_update on public.deals for update to authenticated
  using (
    rm_id = auth.uid()
    or public.is_admin()
    or (
      public.is_team_lead()
      and public.user_team_id() is not null
      and exists (
        select 1 from public.profiles p
        where p.id = deals.rm_id and p.team_id = public.user_team_id()
      )
    )
  )
  with check (
    rm_id = auth.uid()
    or public.is_admin()
    or (
      public.is_team_lead()
      and public.user_team_id() is not null
      and exists (
        select 1 from public.profiles p
        where p.id = deals.rm_id and p.team_id = public.user_team_id()
      )
    )
  );

drop policy if exists deals_delete on public.deals;
create policy deals_delete on public.deals for delete to authenticated
  using (
    rm_id = auth.uid()
    or public.is_admin()
  );  -- 只有 owner 或 admin 能刪(team_lead 不能刪別人的)

-- 7) 子表 policies 用 can_access_deal 重寫 -------------------------
-- scores
drop policy if exists scores_all on public.scores;
create policy scores_all on public.scores for all to authenticated
  using (public.can_access_deal(scores.deal_id))
  with check (public.can_access_deal(scores.deal_id));

-- score_notes
drop policy if exists score_notes_all on public.score_notes;
create policy score_notes_all on public.score_notes for all to authenticated
  using (public.can_access_deal(score_notes.deal_id))
  with check (public.can_access_deal(score_notes.deal_id));

-- stage_checklist
drop policy if exists stage_checklist_all on public.stage_checklist;
create policy stage_checklist_all on public.stage_checklist for all to authenticated
  using (public.can_access_deal(stage_checklist.deal_id))
  with check (public.can_access_deal(stage_checklist.deal_id));

-- comments
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments for select to authenticated
  using (public.can_access_deal(comments.deal_id));
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated
  with check (public.can_access_deal(comments.deal_id));

-- stage_history
drop policy if exists stage_history_select on public.stage_history;
create policy stage_history_select on public.stage_history for select to authenticated
  using (public.can_access_deal(stage_history.deal_id));

-- deal_questions
drop policy if exists deal_questions_all on public.deal_questions;
create policy deal_questions_all on public.deal_questions for all to authenticated
  using (public.can_access_deal(deal_questions.deal_id))
  with check (public.can_access_deal(deal_questions.deal_id));

-- 8) Profiles 寫入權限調整 --------------------------------------
-- Admin 可建立/移除任何人;Team Lead 可建立/移除自己團隊的人
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check (
    public.is_admin()
    or (
      public.is_team_lead()
      and (team_id = public.user_team_id() or team_id is null)
    )
  );

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles for delete to authenticated
  using (
    id != auth.uid()
    and (
      public.is_admin()
      or (public.is_team_lead() and team_id = public.user_team_id())
    )
  );

-- 9) Settings 寫入仍限 admin
drop policy if exists settings_update on public.settings;
create policy settings_update on public.settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 10) Pain points 寫入也限 admin
drop policy if exists pain_points_write on public.pain_points;
create policy pain_points_write on public.pain_points for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
