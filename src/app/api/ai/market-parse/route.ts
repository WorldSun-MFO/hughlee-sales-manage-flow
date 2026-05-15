import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAnthropic, AI_MODEL } from '@/lib/anthropic/client';
import { MARKET_ANALYST_PROMPT } from '@/lib/anthropic/market-prompt';
import { MarketParseResponseSchema, MARKET_PARSE_JSON_SCHEMA } from '@/lib/anthropic/schemas';

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

  const dealList = (deals ?? []) as Array<{ id: string; name: string; product: string | null; stage: string }>;
  const dealLines =
    dealList.length > 0
      ? dealList.map(d => `${d.id} | ${d.name} | 商品:${d.product || '未定'} | 階段:${d.stage}`).join('\n')
      : '(目前沒有可關聯的客戶)';
  const allowedDealIds = new Set(dealList.map(d => d.id));

  const userMessage = `【原文】
${articleText}

【可關聯的客戶清單(deal_id | 客戶名 | 商品 | 階段)】
${dealLines}

請依你的角色把上面原文濃縮成結構化市場情報,並判斷跟哪些客戶相關,輸出 JSON。
- deal_id 只能用上面清單裡出現過的字串,原封不動;清單沒有的不要硬湊。
- 原文沒有的數字/結論不要編;辨識不出的欄位給空字串或空陣列。

JSON Schema:
${JSON.stringify(MARKET_PARSE_JSON_SCHEMA, null, 2)}

只回 JSON,不加任何前後說明文字。`;

  const client = getAnthropic();
  try {
    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 16000,
      // SDK 0.68 型別還沒納入 'adaptive',cast 繞過(API 已 GA 接受)
      thinking: { type: 'adaptive' } as unknown as { type: 'enabled'; budget_tokens: number },
      system: [
        {
          type: 'text',
          text: MARKET_ANALYST_PROMPT,
          cache_control: { type: 'ephemeral' },   // 靜態 prompt 跨呼叫快取
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'AI 沒有回傳文字內容' }, { status: 502 });
    }

    let parsed;
    try {
      parsed = JSON.parse(extractJSON(textBlock.text));
    } catch {
      console.error('[market-parse] JSON parse failed:', textBlock.text.slice(0, 500));
      return NextResponse.json({ error: 'AI 回傳格式錯誤,無法解析 JSON' }, { status: 502 });
    }

    const validated = MarketParseResponseSchema.safeParse(parsed);
    if (!validated.success) {
      console.error('[market-parse] Zod validation failed:', validated.error);
      return NextResponse.json({ error: 'AI 回傳結構不符:' + validated.error.message }, { status: 502 });
    }

    // 防 AI 竄改/幻覺 deal_id:只保留清單內真實存在的關聯
    const safeLinks = validated.data.suggested_deal_links.filter(l => allowedDealIds.has(l.deal_id));

    const usage = {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
    };

    return NextResponse.json(
      { data: { ...validated.data, suggested_deal_links: safeLinks }, usage },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[market-parse] Claude error:', message);
    return NextResponse.json({ error: 'AI 服務暫時無法使用:' + message }, { status: 502 });
  }
}

/** 從 Claude 回應抽出 JSON(處理 ```json ... ``` 包覆與前後文字)。 */
function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text.trim();
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
