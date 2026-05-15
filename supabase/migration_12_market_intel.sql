-- ============================================================
-- Migration 12 — 金融資訊大腦 / Market Intel(Phase 0)
-- ============================================================
-- 目標:在現有 pipeline 上長出「市場情報模組」。
--
-- 設計原則:
--   * 市場情報是「全公司共享的大腦」(團隊知識傳承)→ 全團隊可讀可寫
--   * 但「情報 ↔ 客戶」關聯沿用現有隱私模型(can_access_deal)
--     → 別的 RM 的客戶名單不會因為被關聯就外洩
--   * 只存 AI 摘要 + 標籤 + 原文連結,不存原文(法務風險最低、查詢快)
--   * 同一個個股可有多家券商觀點 → stance 欄位 + ticker 標籤做多空對比
--
-- 4 張表:
--   1) market_intel        情報主表(每一條研報/新聞/財報摘要)
--   2) market_tags         標籤字典(地區/產業/個股/總經/主題)
--   3) intel_tags          情報 ↔ 標籤(多對多)
--   4) intel_deal_links    情報 ↔ 客戶(多對多,沿用 deals 權限)
--
-- 註:Phase 3 會再加 worldsun_views(內部觀點綜合層),此處先不建。
-- ============================================================

-- ---------- 1. 情報主表 ----------
create table if not exists public.market_intel (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  -- 來源類型:券商研報 / 財經媒體 / 公開財報法說 / 內部觀察筆記
  source_type  text not null default 'internal'
               check (source_type in ('broker_research','media','filing','internal')),
  source_name  text default '',                       -- 如「摩根士丹利」「日經新聞」「TWSE」
  source_url   text default '',                       -- 原文連結(看原文時點出去)
  -- 市場地區
  region       text not null default 'TW'
               check (region in ('TW','US','JP','CN','GLOBAL')),
  summary      text default '',                       -- AI 摘要 300–500 字
  key_points   jsonb not null default '[]'::jsonb,    -- 重點 bullet(字串陣列)
  -- 立場:看多 / 看空 / 中性 / 不適用 — 方便同一標的多券商對比
  stance       text not null default 'na'
               check (stance in ('bullish','bearish','neutral','na')),
  author       text default '',                       -- 分析師 / 作者
  published_at date,                                  -- 原文發布日(可空)
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_market_intel_region
  on public.market_intel(region, published_at desc nulls last);
create index if not exists idx_market_intel_source
  on public.market_intel(source_type);
create index if not exists idx_market_intel_created
  on public.market_intel(created_at desc);

-- ---------- 2. 標籤字典 ----------
create table if not exists public.market_tags (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  -- 分類:地區 / 產業 / 個股代號 / 總經 / 主題
  category   text not null
             check (category in ('region','industry','ticker','macro','theme')),
  created_at timestamptz not null default now(),
  unique (category, name)
);
create index if not exists idx_market_tags_category
  on public.market_tags(category, name);

-- ---------- 3. 情報 ↔ 標籤(多對多) ----------
create table if not exists public.intel_tags (
  intel_id uuid not null references public.market_intel(id) on delete cascade,
  tag_id   uuid not null references public.market_tags(id) on delete cascade,
  primary key (intel_id, tag_id)
);
create index if not exists idx_intel_tags_tag on public.intel_tags(tag_id);

-- ---------- 4. 情報 ↔ 客戶(多對多,沿用 deals 權限) ----------
create table if not exists public.intel_deal_links (
  intel_id         uuid not null references public.market_intel(id) on delete cascade,
  deal_id          uuid not null references public.deals(id) on delete cascade,
  relevance_reason text default '',                   -- 為什麼跟這客戶相關
  linked_by        uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  primary key (intel_id, deal_id)
);
create index if not exists idx_intel_deal_links_deal
  on public.intel_deal_links(deal_id);

-- updated_at 自動更新(市場情報會被多人協作編輯,自動戳記比較可靠)
create or replace function public.touch_market_intel() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists on_market_intel_update on public.market_intel;
create trigger on_market_intel_update before update on public.market_intel
  for each row execute function public.touch_market_intel();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.market_intel     enable row level security;
alter table public.market_tags      enable row level security;
alter table public.intel_tags       enable row level security;
alter table public.intel_deal_links enable row level security;

-- 1) 情報主表:全團隊可讀可新增;只有作者或 admin 可改/刪
drop policy if exists market_intel_select on public.market_intel;
create policy market_intel_select on public.market_intel for select to authenticated
  using (true);

drop policy if exists market_intel_insert on public.market_intel;
create policy market_intel_insert on public.market_intel for insert to authenticated
  with check (created_by = auth.uid() or public.is_admin());

drop policy if exists market_intel_update on public.market_intel;
create policy market_intel_update on public.market_intel for update to authenticated
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());

drop policy if exists market_intel_delete on public.market_intel;
create policy market_intel_delete on public.market_intel for delete to authenticated
  using (created_by = auth.uid() or public.is_admin());

-- 2) 標籤字典:全團隊可讀可新增(協作建標籤);只有 admin 可刪(避免亂刪共用標籤)
drop policy if exists market_tags_select on public.market_tags;
create policy market_tags_select on public.market_tags for select to authenticated
  using (true);

drop policy if exists market_tags_insert on public.market_tags;
create policy market_tags_insert on public.market_tags for insert to authenticated
  with check (true);

drop policy if exists market_tags_delete on public.market_tags;
create policy market_tags_delete on public.market_tags for delete to authenticated
  using (public.is_admin());

-- 3) 情報 ↔ 標籤:跟著情報走(情報全團隊可見,標記也是協作行為)
drop policy if exists intel_tags_select on public.intel_tags;
create policy intel_tags_select on public.intel_tags for select to authenticated
  using (true);

drop policy if exists intel_tags_write on public.intel_tags;
create policy intel_tags_write on public.intel_tags for all to authenticated
  using (true) with check (true);

-- 4) 情報 ↔ 客戶:沿用現有隱私模型 — 只有「能存取此 deal 的人」
--    才看得到/才能建立這條關聯(別的 RM 的客戶名單不外洩)
drop policy if exists intel_deal_links_select on public.intel_deal_links;
create policy intel_deal_links_select on public.intel_deal_links for select to authenticated
  using (public.can_access_deal(deal_id));

drop policy if exists intel_deal_links_insert on public.intel_deal_links;
create policy intel_deal_links_insert on public.intel_deal_links for insert to authenticated
  with check (public.can_access_deal(deal_id));

drop policy if exists intel_deal_links_delete on public.intel_deal_links;
create policy intel_deal_links_delete on public.intel_deal_links for delete to authenticated
  using (public.can_access_deal(deal_id));

-- ============================================================
-- Realtime:新情報進來時團隊即時看到(呼應「團隊知識傳承」)
-- ============================================================

do $$ begin
  alter publication supabase_realtime add table public.market_intel;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.intel_deal_links;
exception when duplicate_object then null;
end $$;
