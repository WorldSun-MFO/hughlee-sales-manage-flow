// 付費新聞 API adapter — 回傳與 RSS 相同形狀的 RssItem[],
// 讓 cron 後段(去重/相關性/多元化/Opus 解析)完全不必改。
// 目前支援 NewsData.io;新增供應商只要在 fetchProviderItems 加一個 case。

import type { RssItem } from './rss';

interface SourceLike {
  name: string;
  url: string;                 // 對 API 來源:存「查詢字串」(供應商的 q 參數)
  provider: string | null;
  region: string | null;
}

export type ProviderResult =
  | { ok: true; items: RssItem[]; note?: string }   // note = 非致命提示(如全文受方案限制)
  | { ok: false; error: string };

const TIMEOUT_MS = 15000;
// NewsData.io 免費方案的 content 欄位會回這串字而非全文
const PAID_PLACEHOLDER = 'ONLY AVAILABLE IN PAID';

export async function fetchProviderItems(src: SourceLike): Promise<ProviderResult> {
  switch (src.provider) {
    case 'newsdata':
      return fetchNewsData(src);
    default:
      return { ok: false, error: `未知的 API 供應商:${src.provider ?? '(空)'}` };
  }
}

// ---------- NewsData.io ----------
// docs: https://newsdata.io/documentation  endpoint: GET /api/1/latest
interface NewsDataArticle {
  title?: unknown;
  link?: unknown;
  description?: unknown;
  content?: unknown;
  pubDate?: unknown;
}
interface NewsDataResp {
  status?: unknown;
  results?: unknown;
}

async function fetchNewsData(src: SourceLike): Promise<ProviderResult> {
  const key = process.env.NEWSDATA_API_KEY;
  if (!key) {
    return { ok: false, error: 'NEWSDATA_API_KEY 未設定(請在 Vercel 環境變數加上)' };
  }

  const u = new URL('https://newsdata.io/api/1/latest');
  u.searchParams.set('apikey', key);
  if (src.url.trim()) u.searchParams.set('q', src.url.trim());
  u.searchParams.set('language', 'en');
  u.searchParams.set('category', 'business');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let raw: unknown;
  try {
    const res = await fetch(u.toString(), { signal: controller.signal });
    if (!res.ok) return { ok: false, error: `NewsData HTTP ${res.status}` };
    raw = await res.json();
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }

  const resp = raw as NewsDataResp;
  if (resp.status !== 'success' || !Array.isArray(resp.results)) {
    return { ok: false, error: `NewsData 回應異常(status=${String(resp.status)})` };
  }

  let gated = false;
  const items: RssItem[] = [];
  for (const a of resp.results as NewsDataArticle[]) {
    const title = typeof a.title === 'string' ? a.title.trim() : '';
    const link = typeof a.link === 'string' ? a.link.trim() : '';
    if (!title || !link) continue;

    const content = typeof a.content === 'string' ? a.content : '';
    const desc = typeof a.description === 'string' ? a.description : '';
    let body = content;
    if (!body || body.toUpperCase().includes(PAID_PLACEHOLDER)) {
      body = desc;          // 免費方案 content 被鎖 → 降級用 description
      gated = true;
    }

    items.push({
      title,
      link,
      description: body || desc || title,
      pubDate: typeof a.pubDate === 'string' ? a.pubDate : null,
    });
  }

  return {
    ok: true,
    items,
    note: gated
      ? '全文受免費方案限制,暫用 description(升級付費方案可解鎖 content 全文)'
      : undefined,
  };
}
