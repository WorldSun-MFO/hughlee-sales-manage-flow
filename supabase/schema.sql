-- ============================================================
-- 沃勝 MEDDIC Pipeline — Supabase Schema
-- Run this in Supabase SQL Editor once after creating the project.
-- ============================================================

-- ---------- 1. Profiles (extends auth.users) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  rm_code text,
  role text not null default 'rm' check (role in ('rm', 'manager')),
  created_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, rm_code, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'rm'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: is current user a manager?
create or replace function public.is_manager() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'manager');
$$;

-- ---------- 2. Deals ----------
create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rm_id uuid not null references public.profiles(id) on delete restrict,
  aum_usd numeric not null default 0,
  product text default '',
  first_contact date not null default current_date,
  last_updated timestamptz not null default now(),
  stage text not null default 'L1' check (stage in ('L1','L2','L3','L4','L5','L6','L7')),
  next_step text default '',
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);
create index if not exists idx_deals_rm on public.deals(rm_id);
create index if not exists idx_deals_stage on public.deals(stage);
create index if not exists idx_deals_updated on public.deals(last_updated desc);

-- ---------- 3. Scores (1:1 with deal) ----------
create table if not exists public.scores (
  deal_id uuid primary key references public.deals(id) on delete cascade,
  m  int not null default 0 check (m  between 0 and 10),
  e  int not null default 0 check (e  between 0 and 10),
  d1 int not null default 0 check (d1 between 0 and 10),
  d2 int not null default 0 check (d2 between 0 and 10),
  p  int not null default 0 check (p  between 0 and 10),
  i  int not null default 0 check (i  between 0 and 10),
  c1 int not null default 0 check (c1 between 0 and 10),
  c2 int not null default 0 check (c2 between 0 and 10),
  updated_at timestamptz not null default now()
);

-- Auto-create a scores row when a deal is inserted
create or replace function public.init_scores() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.scores (deal_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists on_deal_created on public.deals;
create trigger on_deal_created after insert on public.deals
  for each row execute function public.init_scores();

-- ---------- 4. Score notes (evidence + next action per MEDDIC field) ----------
create table if not exists public.score_notes (
  deal_id uuid references public.deals(id) on delete cascade,
  field text not null check (field in ('m','e','d1','d2','p','i','c1','c2')),
  evidence text default '',
  next_action text default '',
  updated_at timestamptz not null default now(),
  primary key (deal_id, field)
);

-- ---------- 5. Stage checklist (per deal) ----------
create table if not exists public.stage_checklist (
  deal_id uuid references public.deals(id) on delete cascade,
  item_key text not null,
  checked boolean not null default true,
  checked_by uuid references public.profiles(id),
  checked_at timestamptz not null default now(),
  primary key (deal_id, item_key)
);

-- ---------- 6. Comments ----------
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  author_id uuid references public.profiles(id),
  body text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_comments_deal on public.comments(deal_id, created_at desc);

-- ---------- 7. Stage history ----------
create table if not exists public.stage_history (
  id bigserial primary key,
  deal_id uuid not null references public.deals(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  changed_by uuid references public.profiles(id),
  reason text,
  changed_at timestamptz not null default now()
);
create index if not exists idx_stage_history_deal on public.stage_history(deal_id, changed_at desc);

-- Auto-log stage change
create or replace function public.log_stage_change() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.stage is distinct from old.stage then
    insert into public.stage_history (deal_id, from_stage, to_stage, changed_by)
    values (new.id, old.stage, new.stage, auth.uid());
  end if;
  return new;
end;
$$;
drop trigger if exists on_deal_stage_change on public.deals;
create trigger on_deal_stage_change after update of stage on public.deals
  for each row execute function public.log_stage_change();

-- ---------- 8. Settings (singleton) ----------
create table if not exists public.settings (
  id int primary key default 1,
  stage_probs jsonb not null default '{"L1":7,"L2":13,"L3":20,"L4":44,"L5":68,"L6":90,"L7":100}'::jsonb,
  red_flag   jsonb not null default '{"ebScore":4,"totalScore":40,"staleDays":30}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint settings_singleton check (id = 1)
);
insert into public.settings (id) values (1) on conflict do nothing;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles        enable row level security;
alter table public.deals           enable row level security;
alter table public.scores          enable row level security;
alter table public.score_notes     enable row level security;
alter table public.stage_checklist enable row level security;
alter table public.comments        enable row level security;
alter table public.stage_history   enable row level security;
alter table public.settings        enable row level security;

-- Profiles: all team members read all profiles; user updates own; manager updates any
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_manager())
  with check (id = auth.uid() or public.is_manager());

-- Deals: RM sees own + manager sees all
drop policy if exists deals_select on public.deals;
create policy deals_select on public.deals for select to authenticated
  using (rm_id = auth.uid() or public.is_manager());
drop policy if exists deals_insert on public.deals;
create policy deals_insert on public.deals for insert to authenticated
  with check (rm_id = auth.uid() or public.is_manager());
drop policy if exists deals_update on public.deals;
create policy deals_update on public.deals for update to authenticated
  using (rm_id = auth.uid() or public.is_manager())
  with check (rm_id = auth.uid() or public.is_manager());
drop policy if exists deals_delete on public.deals;
create policy deals_delete on public.deals for delete to authenticated
  using (rm_id = auth.uid() or public.is_manager());

-- Scores / notes / checklist / comments: inherit from parent deal
drop policy if exists scores_all on public.scores;
create policy scores_all on public.scores for all to authenticated
  using (exists (select 1 from public.deals d where d.id = scores.deal_id and (d.rm_id = auth.uid() or public.is_manager())))
  with check (exists (select 1 from public.deals d where d.id = scores.deal_id and (d.rm_id = auth.uid() or public.is_manager())));

drop policy if exists score_notes_all on public.score_notes;
create policy score_notes_all on public.score_notes for all to authenticated
  using (exists (select 1 from public.deals d where d.id = score_notes.deal_id and (d.rm_id = auth.uid() or public.is_manager())))
  with check (exists (select 1 from public.deals d where d.id = score_notes.deal_id and (d.rm_id = auth.uid() or public.is_manager())));

drop policy if exists stage_checklist_all on public.stage_checklist;
create policy stage_checklist_all on public.stage_checklist for all to authenticated
  using (exists (select 1 from public.deals d where d.id = stage_checklist.deal_id and (d.rm_id = auth.uid() or public.is_manager())))
  with check (exists (select 1 from public.deals d where d.id = stage_checklist.deal_id and (d.rm_id = auth.uid() or public.is_manager())));

drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments for select to authenticated
  using (exists (select 1 from public.deals d where d.id = comments.deal_id and (d.rm_id = auth.uid() or public.is_manager())));
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated
  with check (exists (select 1 from public.deals d where d.id = comments.deal_id and (d.rm_id = auth.uid() or public.is_manager())));

drop policy if exists stage_history_select on public.stage_history;
create policy stage_history_select on public.stage_history for select to authenticated
  using (exists (select 1 from public.deals d where d.id = stage_history.deal_id and (d.rm_id = auth.uid() or public.is_manager())));

-- Settings: everyone reads; only manager updates
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select to authenticated using (true);
drop policy if exists settings_update on public.settings;
create policy settings_update on public.settings for update to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- ============================================================
-- Realtime: broadcast changes so team sees updates instantly
-- ============================================================

alter publication supabase_realtime add table public.deals;
alter publication supabase_realtime add table public.scores;
alter publication supabase_realtime add table public.score_notes;
alter publication supabase_realtime add table public.stage_checklist;
alter publication supabase_realtime add table public.comments;
