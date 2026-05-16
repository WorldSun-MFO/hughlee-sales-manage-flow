-- ============================================================
-- Migration 14 — Google News 財經查詢來源(金融資訊大腦 Phase 5.2-b)
-- ============================================================
-- 把 8 組 WORLDSUN 相關的 Google News RSS 查詢加入 ingest_sources。
-- Google News 結果本身依「報導熱度」排序 → 等於免費的聲量來源。
-- ingest_sources 有 unique(url),on conflict do nothing → 可重複執行。
-- 來源管理 UI(5.2-d)上線後可在線上自行增減,不必再改 SQL。
-- ============================================================

insert into public.ingest_sources (name, kind, url, region, active) values
('Google News: 台股','rss','https://news.google.com/rss/search?q=%E5%8F%B0%E8%82%A1&hl=zh-TW&gl=TW&ceid=TW:zh-Hant','TW',true),
('Google News: 美股','rss','https://news.google.com/rss/search?q=%E7%BE%8E%E8%82%A1&hl=zh-TW&gl=TW&ceid=TW:zh-Hant','US',true),
('Google News: 聯準會 利率 通膨','rss','https://news.google.com/rss/search?q=%E8%81%AF%E6%BA%96%E6%9C%83%20%E5%88%A9%E7%8E%87%20%E9%80%9A%E8%86%A8&hl=zh-TW&gl=TW&ceid=TW:zh-Hant','GLOBAL',true),
('Google News: 半導體 AI','rss','https://news.google.com/rss/search?q=%E5%8D%8A%E5%B0%8E%E9%AB%94%20AI&hl=zh-TW&gl=TW&ceid=TW:zh-Hant','GLOBAL',true),
('Google News: 台積電','rss','https://news.google.com/rss/search?q=%E5%8F%B0%E7%A9%8D%E9%9B%BB&hl=zh-TW&gl=TW&ceid=TW:zh-Hant','TW',true),
('Google News: 輝達 NVIDIA','rss','https://news.google.com/rss/search?q=%E8%BC%9D%E9%81%94%20NVIDIA&hl=zh-TW&gl=TW&ceid=TW:zh-Hant','US',true),
('Google News: 遺產稅 贈與稅 傳承','rss','https://news.google.com/rss/search?q=%E9%81%BA%E7%94%A2%E7%A8%85%20%E8%B4%88%E8%88%87%E7%A8%85%20%E5%82%B3%E6%89%BF&hl=zh-TW&gl=TW&ceid=TW:zh-Hant','TW',true),
('Google News: 家族信託 資產配置','rss','https://news.google.com/rss/search?q=%E5%AE%B6%E6%97%8F%E4%BF%A1%E8%A8%97%20%E8%B3%87%E7%94%A2%E9%85%8D%E7%BD%AE&hl=zh-TW&gl=TW&ceid=TW:zh-Hant','TW',true)
on conflict (url) do nothing;
