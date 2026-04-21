-- ============================================================
-- Migration 4 — 客戶等級 (SSS/S/A/C) + 聯繫頻率提醒
-- 1) deals 加 tier + last_contact_at 欄
-- 2) settings 加 tier_config 欄
-- 3) 既有資料自動 backfill(依 AUM 分級、last_contact_at 用 last_updated)
-- ============================================================

-- ---------- 1. deals 新增欄位 ----------
alter table public.deals
  add column if not exists tier text check (tier in ('SSS','S','A','C') or tier is null);

alter table public.deals
  add column if not exists last_contact_at timestamptz;

-- Backfill: last_contact_at ← last_updated(只補 NULL 的)
update public.deals
  set last_contact_at = last_updated
  where last_contact_at is null;

-- Backfill: 依 AUM 自動分級(只補 tier 仍為 NULL 的)
update public.deals
  set tier = case
    when aum_usd >= 80000000 then 'SSS'
    when aum_usd >= 50000000 then 'S'
    when aum_usd >= 10000000 then 'A'
    else 'C'
  end
  where tier is null;

-- ---------- 2. settings 加入 tier_config ----------
alter table public.settings
  add column if not exists tier_config jsonb not null default '{
    "tiers": [
      { "key": "SSS", "name": "旗艦 Flagship",  "aum_min": 80000000, "contact_days": 14 },
      { "key": "S",   "name": "高階 Premier",   "aum_min": 50000000, "contact_days": 30 },
      { "key": "A",   "name": "中階 Advanced",  "aum_min": 10000000, "contact_days": 30 },
      { "key": "C",   "name": "基礎 Foundation","aum_min":  1000000, "contact_days": 90 }
    ]
  }'::jsonb;
