-- ============================================================
-- Migration 18 — 國際新聞來源 + 雙語關鍵字閘門(金融資訊大腦)
-- ============================================================
-- 1) ingest_sources.kind 放寬:'rss' → 'rss' | 'api'(容許付費新聞 API 來源)
-- 2) 新欄位:
--    provider           — API 供應商代號(如 'newsdata');RSS 來源為 null
--    skip_keyword_gate  — true 表示此來源跳過中/英文相關性關鍵字閘門
--                         (查詢型/已篩過的可信來源,查詢本身即過濾)
-- 3) 種子:已實測 200 + 可解析的免費中文/台股 RSS
-- 4) 種子:NewsData.io 國際財經全文 API(預設 active=false,
--    待 Vercel 設好 NEWSDATA_API_KEY 後再啟用)
-- 全部 idempotent;ingest_sources 有 unique(url),on conflict do nothing。
-- 修改既有 table 欄位,不涉權限判斷 → 不需改 RLS(見 CLAUDE.md 規則 2)。
-- ============================================================

-- ---------- 1) 放寬 kind 限制 ----------
alter table public.ingest_sources drop constraint if exists ingest_sources_kind_check;
alter table public.ingest_sources
  add constraint ingest_sources_kind_check check (kind in ('rss','api'));

-- ---------- 2) 新欄位 ----------
alter table public.ingest_sources add column if not exists provider text;
alter table public.ingest_sources
  add column if not exists skip_keyword_gate boolean not null default false;

-- ---------- 3) 免費中文/台股 RSS(已實測可用) ----------
insert into public.ingest_sources (name, kind, url, region, active) values
  ('鉅亨網 台股',   'rss', 'https://news.cnyes.com/rss/v1/news/category/tw_stock',  'TW',     true),
  ('鉅亨網 國際股', 'rss', 'https://news.cnyes.com/rss/v1/news/category/wd_stock',  'GLOBAL', true),
  ('中央社 財經',   'rss', 'https://feeds.feedburner.com/rsscna/finance',           'TW',     true),
  ('經濟日報 即時', 'rss', 'https://money.udn.com/rssfeed/news/1001/5591?ch=money', 'TW',     true),
  ('自由財經',      'rss', 'https://news.ltn.com.tw/rss/business.xml',              'TW',     true)
on conflict (url) do nothing;

-- ---------- 4) NewsData.io 國際財經(全文 API)----------
-- ⚠️ 預設 active=false。流程:
--   (a) 到 newsdata.io 註冊 → 取得 API key
--   (b) Vercel 環境變數加 NEWSDATA_API_KEY=<key>(server only,勿進前端)
--   (c) 確認可抓後,把此列 active 改 true:
--       update public.ingest_sources set active = true
--       where url = 'wealth management OR estate tax OR family office OR structured products';
--   url 欄位對 API 來源存「查詢字串」(NewsData 的 q 參數),非網址。
insert into public.ingest_sources
  (name, kind, url, region, active, provider, skip_keyword_gate) values
  ('NewsData.io 國際財經', 'api',
   'wealth management OR estate tax OR family office OR structured products',
   'GLOBAL', false, 'newsdata', true)
on conflict (url) do nothing;
