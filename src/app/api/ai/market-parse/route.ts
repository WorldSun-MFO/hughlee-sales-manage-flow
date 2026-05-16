import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseMarketIntel, type ParseDeal } from '@/lib/anthropic/market-parse-core';

export const runtime = 'nodejs';
export const maxDuration = 300;

interface ReqBody {
  text?: string;
  url?: string;
}

const MAX_ARTICLE_CHARS = 40000;   // 控制成本/延遲
const MAX_DEALS_FED = 80;          // 餵給 AI 的客戶清單上限(admin 可能看到很多)

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登入' }, { status: 401 });

  const body = (await request.json()) as ReqBody;
  const rawText = body.text?.trim() ?? '';
  const url = body.url?.trim() ?? '';

  if (!rawText && !url) {
    return NextResponse.json({ error: '請貼上原文或提供網址' }, { status: 400 });
  }

  // 1) 取得文章內文(貼文字優先;否則抓網址)
  let articleText = rawText;
  if (!articleText && url) {
    const fetched = await fetchReadableText(url);
    if (!fetched.ok) {
      return NextResponse.json({ error: fetched.error }, { status: 422 });
    }
    articleText = fetched.text;
  }
  articleText = articleText.slice(0, MAX_ARTICLE_CHARS);
  if (articleText.length < 30) {
    return NextResponse.json({ error: '內文太短,無法解析。請改用貼文字。' }, { status: 422 });
  }

  // 2) 取得「使用者權限內可見的客戶」(RLS 自動限制,別的 RM 客戶不會出現)
  const { data: deals } = await supabase
    .from('deals')
    .select('id, name, product, stage')
    .order('last_updated', { ascending: false })
    .limit(MAX_DEALS_FED);

  const dealList: ParseDeal[] = (deals ?? []) as ParseDeal[];

  const result = await parseMarketIntel(articleText, dealList);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ data: result.data, usage: result.usage });
}

function safeParseUrl(s: string): URL | null {
  try {
    return new URL(s);
  } catch {
    return null;
  }
}

/** 盡力抓網址內文:擋私網(SSRF)、去 script/style/tag、收斂空白。失敗回友善訊息。 */
async function fetchReadableText(rawUrl: string): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const u = safeParseUrl(rawUrl);
  if (!u) {
    return { ok: false, error: '網址格式不正確' };
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, error: '只支援 http/https 網址' };
  }
  const host = u.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return { ok: false, error: '不允許抓取內部網址' };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(u.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { ok: false, error: `抓取失敗(HTTP ${res.status})。可能有付費牆或反爬,請改用貼文字。` };
    }
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length < 200) {
      return { ok: false, error: '這個網址抓不到足夠內文(可能是付費牆/需登入/JS 渲染)。請改用貼文字。' };
    }
    return { ok: true, text };
  } catch {
    return { ok: false, error: '抓取網址逾時或失敗,請改用貼文字。' };
  }
}
