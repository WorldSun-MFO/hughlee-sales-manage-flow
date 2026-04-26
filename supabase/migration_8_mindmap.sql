-- ============================================================
-- Migration 8 — 心智圖 (mindmap_nodes)
-- Phase 1:個人知識庫 (B) + 突發奇想 Inbox (D)
-- 樹狀結構 (parent_id 自我參照),每人只看自己的節點 (RLS)
-- ============================================================

create extension if not exists pg_trgm;

create table if not exists public.mindmap_nodes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.mindmap_nodes(id) on delete cascade,
  content text not null default '',
  tags text[] not null default '{}',
  is_inbox boolean not null default false,   -- D 用:突發奇想未分類
  voice_url text,                             -- 原始音檔 URL(選填)
  position int not null default 0,            -- 同一 parent 下的排序
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 索引:列樹、找 inbox、最近修改
create index if not exists mindmap_nodes_owner_parent_idx
  on public.mindmap_nodes(owner_id, parent_id);

create index if not exists mindmap_nodes_owner_inbox_idx
  on public.mindmap_nodes(owner_id, is_inbox)
  where is_inbox = true;

create index if not exists mindmap_nodes_owner_updated_idx
  on public.mindmap_nodes(owner_id, updated_at desc);

-- 中文 substring 搜尋:trigram 索引(比 to_tsvector 對 CJK 友善)
create index if not exists mindmap_nodes_content_trgm_idx
  on public.mindmap_nodes using gin (content gin_trgm_ops);

-- updated_at 自動更新
create or replace function public.mindmap_nodes_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists mindmap_nodes_updated_at on public.mindmap_nodes;
create trigger mindmap_nodes_updated_at
  before update on public.mindmap_nodes
  for each row execute function public.mindmap_nodes_set_updated_at();

-- RLS:每人只能看 / 改自己的節點
alter table public.mindmap_nodes enable row level security;

drop policy if exists mindmap_nodes_select_own on public.mindmap_nodes;
create policy mindmap_nodes_select_own
  on public.mindmap_nodes for select
  using (auth.uid() = owner_id);

drop policy if exists mindmap_nodes_insert_own on public.mindmap_nodes;
create policy mindmap_nodes_insert_own
  on public.mindmap_nodes for insert
  with check (auth.uid() = owner_id);

drop policy if exists mindmap_nodes_update_own on public.mindmap_nodes;
create policy mindmap_nodes_update_own
  on public.mindmap_nodes for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists mindmap_nodes_delete_own on public.mindmap_nodes;
create policy mindmap_nodes_delete_own
  on public.mindmap_nodes for delete
  using (auth.uid() = owner_id);
