-- ============================================================
-- Migration 5 — 新增 B 初階(Entry)客戶等級
-- AUM 門檻 $5M,聯繫週期 60 天
-- ============================================================

-- 1) 放寬 deals.tier 的 CHECK 約束,加入 'B'
alter table public.deals drop constraint if exists deals_tier_check;
alter table public.deals add constraint deals_tier_check check (tier in ('SSS','S','A','B','C') or tier is null);

-- 2) 更新現有 settings 那筆(id=1)的 tier_config,加入 B
update public.settings set tier_config = '{
  "tiers": [
    { "key": "SSS", "name": "旗艦 Flagship",   "aum_min": 80000000, "contact_days": 14 },
    { "key": "S",   "name": "高階 Premier",    "aum_min": 50000000, "contact_days": 30 },
    { "key": "A",   "name": "中階 Advanced",   "aum_min": 10000000, "contact_days": 30 },
    { "key": "B",   "name": "初階 Entry",      "aum_min":  5000000, "contact_days": 60 },
    { "key": "C",   "name": "基礎 Foundation", "aum_min":  1000000, "contact_days": 90 }
  ]
}'::jsonb where id = 1;

-- 3) 同步更新 column default,未來若重建 settings 會用新預設
alter table public.settings alter column tier_config set default '{
  "tiers": [
    { "key": "SSS", "name": "旗艦 Flagship",   "aum_min": 80000000, "contact_days": 14 },
    { "key": "S",   "name": "高階 Premier",    "aum_min": 50000000, "contact_days": 30 },
    { "key": "A",   "name": "中階 Advanced",   "aum_min": 10000000, "contact_days": 30 },
    { "key": "B",   "name": "初階 Entry",      "aum_min":  5000000, "contact_days": 60 },
    { "key": "C",   "name": "基礎 Foundation", "aum_min":  1000000, "contact_days": 90 }
  ]
}'::jsonb;

-- 4) 重新分級:$5M–$10M 區段且當前為 'C' 的 deal 改為 'B'
--    (保留手動改過的等級,只動原本是 C 的自動分類)
update public.deals
  set tier = 'B'
  where tier = 'C'
    and aum_usd >= 5000000
    and aum_usd <  10000000;
