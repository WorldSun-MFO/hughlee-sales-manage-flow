-- ============================================================
-- Migration 27 — 任務「協作者」(多人指派)
-- ============================================================
-- 任務原本只有單一 assignee_id(主責人)。實務上一個任務常需要多人一起
-- 討論 / 開會,故新增 participant_ids:主責人之外的「協作者」清單。
--
-- 設計:assignee_id 仍是「唯一主責人」(責任歸屬、分組、週報都沿用它);
--       participant_ids 是額外協作者。行事曆同步時,主責人 + 所有協作者
--       (限 @wsgfo.com)一起設為事件與會者,Google 自動寄開會邀請。
-- ============================================================

alter table public.tasks
  add column if not exists participant_ids uuid[] not null default '{}';

-- 陣列成員查詢(RLS 的 auth.uid() = any(participant_ids))走 GIN 較快
create index if not exists idx_tasks_participants on public.tasks using gin (participant_ids);

-- ------------------------------------------------------------
-- RLS:讓「協作者」也能看見 / 修改任務
-- ------------------------------------------------------------
-- 只在原有條件後 OR 進「我在 participant_ids 裡」,其餘維持 migration_10。
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (
    assignee_id = auth.uid()
    or auth.uid() = any(participant_ids)        -- 新增:我是協作者
    or created_by = auth.uid()
    or public.is_admin()
    or (deal_id is not null and public.can_access_deal(deal_id))
    or (
      public.is_team_lead()
      and assignee_id is not null
      and exists (
        select 1 from public.profiles p
        where p.id = tasks.assignee_id and p.team_id = public.user_team_id()
      )
    )
  );

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update to authenticated
  using (
    assignee_id = auth.uid()
    or auth.uid() = any(participant_ids)        -- 新增:協作者可參與更新
    or created_by = auth.uid()
    or public.is_admin()
    or (deal_id is not null and public.can_access_deal(deal_id))
  )
  with check (
    assignee_id = auth.uid()
    or auth.uid() = any(participant_ids)
    or created_by = auth.uid()
    or public.is_admin()
    or (deal_id is not null and public.can_access_deal(deal_id))
  );
