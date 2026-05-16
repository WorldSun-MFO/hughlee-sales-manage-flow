import { getAnthropic, AI_MODEL } from './client';
import { MARKET_ANALYST_PROMPT } from './market-prompt';
import { MarketParseResponseSchema, MARKET_PARSE_JSON_SCHEMA } from './schemas';
import type { MarketParseResponse } from './schemas';

export interface ParseDeal {
  id: string;
  name: string;
  product: string | null;
  stage: string;
}

export interface ParseUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
}

export type ParseResult =
  | { ok: true; data: MarketParseResponse; usage: ParseUsage }
  | { ok: false; error: string };

/** 從 Claude 回應抽出 JSON(處理 ```json ... ``` 包覆與前後文字)。 */
export function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text.trim();
}

/**
 * 市場情報解析核心:文章原文 + 可關聯客戶清單 → Opus 摘要/標籤/建議關聯。
 * API route(人工貼)與 cron(自動抓)共用,確保邏輯單一來源。
 */
export async function parseMarketIntel(
  articleText: string,
  deals: ParseDeal[]
): Promise<ParseResult> {
  const dealLines =
    deals.length > 0
      ? deals.map(d => `${d.id} | ${d.name} | 商品:${d.product || '未定'} | 階段:${d.stage}`).join('\n')
      : '(目前沒有可關聯的客戶)';
  const allowedDealIds = new Set(deals.map(d => d.id));

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
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return { ok: false, error: 'AI 沒有回傳文字內容' };
    }

    let parsed;
    try {
      parsed = JSON.parse(extractJSON(textBlock.text));
    } catch {
      console.error('[market-parse-core] JSON parse failed:', textBlock.text.slice(0, 500));
      return { ok: false, error: 'AI 回傳格式錯誤,無法解析 JSON' };
    }

    const validated = MarketParseResponseSchema.safeParse(parsed);
    if (!validated.success) {
      console.error('[market-parse-core] Zod validation failed:', validated.error);
      return { ok: false, error: 'AI 回傳結構不符:' + validated.error.message };
    }

    const safeLinks = validated.data.suggested_deal_links.filter(l => allowedDealIds.has(l.deal_id));

    return {
      ok: true,
      data: { ...validated.data, suggested_deal_links: safeLinks },
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
        cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[market-parse-core] Claude error:', message);
    return { ok: false, error: 'AI 服務暫時無法使用:' + message };
  }
}
