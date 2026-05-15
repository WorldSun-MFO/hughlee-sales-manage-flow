-- ============================================================
-- Migration 10 — 任務追蹤系統(Sprint B)
-- ============================================================
-- Abbie 用來跨案件對焦任務、指派人員、追蹤完成狀態。
-- 雙向同步:案件下一步可一鍵升級為任務;任務 update 可選擇性回寫 deal.next_step。
-- ============================================================

create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid references public.deals(id) on delete cascade,    -- 可空(獨立任務)
  title         text not null,
  description   text default '',
  assignee_id   uuid references public.profiles(id) on delete set null,
  due_date      date,
  status        text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  priority      text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  source_type   text not null default 'manual' check (source_type in ('manual', 'deal_next_step', 'ai_plan_step')),
  source_ref    text default '',                                       -- 例:plan step key
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index if not exists idx_tasks_assignee_status on public.tasks(assignee_id, status);
create index if not exists idx_tasks_deal on public.tasks(deal_id);
create index if not exists idx_tasks_due on public.tasks(due_date) where status != 'done';

alter table public.tasks enable row level security;

-- 可看見的任務:
-- 1) 我被指派的
-- 2) 我建立的
-- 3) 我有權限的 deal 上的任務(走 can_access_deal)
-- 4) Admin 看全部
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (
    assignee_id = auth.uid()
    or created_by = auth.uid()
    or public.is_admin()
    or (deal_id is not null and public.can_access_deal(deal_id))
    or (
      -- Team Lead 看自己團隊成員被指派的任務(無 deal 的)
      public.is_team_lead()
      and assignee_id is not null
      and exists (
        select 1 from public.profiles p
        where p.id = tasks.assignee_id and p.team_id = public.user_team_id()
      )
    )
  );

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert to authenticated
  with check (
    -- 任何登入者都可建立任務(指派對象由前端控管 — Team Lead 限自己團隊)
    true
  );

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update to authenticated
  using (
    assignee_id = auth.uid()
    or created_by = auth.uid()
    or public.is_admin()
    or (deal_id is not null and public.can_access_deal(deal_id))
  )
  with check (
    assignee_id = auth.uid()
    or created_by = auth.uid()
    or public.is_admin()
    or (deal_id is not null and public.can_access_deal(deal_id))
  );

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete to authenticated
  using (
    created_by = auth.uid()
    or public.is_admin()
    or (deal_id is not null and exists(
      select 1 from public.deals d where d.id = tasks.deal_id and d.rm_id = auth.uid()
    ))
  );

do $$ begin
  alter publication supabase_realtime add table public.tasks;
exception when duplicate_object then null;
end $$;

-- 觸發器:任務標記 done 時自動填 completed_at
create or replace function public.tasks_set_completed_at() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'done' and (old.status is null or old.status != 'done') then
    new.completed_at = now();
  elsif new.status != 'done' then
    new.completed_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists on_task_status_change on public.tasks;
create trigger on_task_status_change
  before insert or update of status on public.tasks
  for each row execute function public.tasks_set_completed_at();
