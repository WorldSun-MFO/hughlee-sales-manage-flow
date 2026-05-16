-- ============================================================
-- Migration 13 — 自動抓取基礎(金融資訊大腦 Phase 5.1)
-- ============================================================
-- 1) market_intel 加 source_origin:分辨人工 vs 自動進件
-- 2) market_intel.source_url 部分索引:自動進件去重用
-- 3) ingest_sources:來源註冊表(RSS 等),Manager 可 CRUD
-- 4) intel_link_suggestions:AI 配對「待審清單」,不自動寫死關聯,
--    RM 採納後才複製進 intel_deal_links(沿用 can_access_deal 隱私模型)
-- ============================================================

-- ---------- 1) source_origin ----------
alter table public.market_intel
  add column if not exists source_origin text not null default 'manual'
  check (source_origin in ('manual','auto'));

-- ---------- 2) 去重索引(只索引非空 url) ----------
create index if not exists idx_market_intel_source_url
  on public.market_intel(source_url)
  where source_url <> '';

-- ---------- 3) 來源註冊表 ----------
create table if not exists public.ingest_sources (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  kind         text not null default 'rss' check (kind in ('rss')),
  url          text not null,
  region       text check (region in ('TW','US','JP','CN','GLOBAL')),
  active       boolean not null default true,
  last_run_at  timestamptz,
  last_status  text default '',
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (url)
);
create index if not exists idx_ingest_sources_active
  on public.ingest_sources(active);

-- 種子:鉅亨網頭條(Phase 5.1 先跑通這一個)
insert into public.ingest_sources (name, kind, url, region, active)
values ('鉅亨網 頭條', 'rss', 'https://news.cnyes.com/rss/v1/news/category/headline', 'TW', true)
on conflict (url) do nothing;

-- ---------- 4) 配對建議待審表 ----------
create table if not exists public.intel_link_suggestions (
  id               uuid primary key default gen_random_uuid(),
  intel_id         uuid not null references public.market_intel(id) on delete cascade,
  deal_id          uuid not null references public.deals(id) on delete cascade,
  relevance_reason text default '',
  status           text not null default 'pending'
                   check (status in ('pending','accepted','dismissed')),
  decided_by       uuid references public.profiles(id) on delete set null,
  decided_at       timestamptz,
  created_at       timestamptz not null default now(),
  unique (intel_id, deal_id)
);
create index if not exists idx_intel_link_sugg_deal
  on public.intel_link_suggestions(deal_id, status);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.ingest_sources         enable row level security;
alter table public.intel_link_suggestions enable row level security;

-- 來源註冊表:全團隊可讀;只有 Manager(admin/team_lead)可增改刪
drop policy if exists ingest_sources_select on public.ingest_sources;
create policy ingest_sources_select on public.ingest_sources for select to authenticated
  using (true);

drop policy if exists ingest_sources_write on public.ingest_sources;
create policy ingest_sources_write on public.ingest_sources for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- 配對建議:沿用客戶隱私模型 — 只有能存取該 deal 的人看得到/能審
drop policy if exists intel_link_sugg_select on public.intel_link_suggestions;
create policy intel_link_sugg_select on public.intel_link_suggestions for select to authenticated
  using (public.can_access_deal(deal_id));

drop policy if exists intel_link_sugg_update on public.intel_link_suggestions;
create policy intel_link_sugg_update on public.intel_link_suggestions for update to authenticated
  using (public.can_access_deal(deal_id))
  with check (public.can_access_deal(deal_id));

drop policy if exists intel_link_sugg_delete on public.intel_link_suggestions;
create policy intel_link_sugg_delete on public.intel_link_suggestions for delete to authenticated
  using (public.can_access_deal(deal_id));

-- 註:自動抓取的 cron 用 service_role 寫入(繞 RLS),故不需 insert policy。
-- 一般登入者不直接 insert 建議(由系統產生),所以不開放 authenticated insert。

-- ============================================================
-- Realtime:新配對建議即時通知 RM
-- ============================================================

do $$ begin
  alter publication supabase_realtime add table public.intel_link_suggestions;
exception when duplicate_object then null;
end $$;
