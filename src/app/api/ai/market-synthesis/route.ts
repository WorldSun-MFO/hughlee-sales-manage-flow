import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { IS_DEMO } from '@/lib/demo';
import { getAnthropic, AI_MODEL } from '@/lib/anthropic/client';
import { MARKET_SYNTHESIS_PROMPT } from '@/lib/anthropic/synthesis-prompt';
import { MarketSynthesisResponseSchema, MARKET_SYNTHESIS_JSON_SCHEMA } from '@/lib/anthropic/schemas';

export const runtime = 'nodejs';
export const maxDuration = 300;

interface ReqBody {
  tagId?: string;
}

const MAX_INTEL = 40;
const SUMMARY_CAP = 600;

interface IntelRow {
  id: string;
  title: string;
  source_name: string | null;
  source_type: string;
  stance: string;
  region: string;
  summary: string | null;
  author: string | null;
  published_at: string | null;
}

const SOURCE_TYPE_TXT: Record<string, string> = {
  broker_research: '券商研報', media: '財經媒體', filing: '公開財報法說', internal: '內部觀察',
};
const STANCE_TXT: Record<string, string> = {
  bullish: '看多', bearish: '看空', neutral: '中性', na: '未標',
};

export async function POST(request: Request) {
  if (IS_DEMO) return NextResponse.json({ error: 'demo 為唯讀環境' }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登入' }, { status: 401 });

  const body = (await request.json()) as ReqBody;
  const tagId = body.tagId?.trim();
  if (!tagId) return NextResponse.json({ error: '缺少 tagId' }, { status: 400 });

  const { data: tag } = await supabase
    .from('market_tags')
    .select('id, name, category')
    .eq('id', tagId)
    .single();

  if (!tag) return NextResponse.json({ error: '找不到這個標籤' }, { status: 404 });

  const { data: rows } = await supabase
    .from('intel_tags')
    .select('market_intel(id, title, source_name, source_type, stance, region, summary, author, published_at)')
    .eq('tag_id', tagId)
    .limit(MAX_INTEL);

  const linked = (rows ?? []) as unknown as Array<{ market_intel: IntelRow | IntelRow[] | null }>;
  const intel: IntelRow[] = [];
  for (const r of linked) {
    const mi = Array.isArray(r.market_intel) ? r.market_intel[0] : r.market_intel;
    if (mi?.id) intel.push(mi);
  }

  if (intel.length === 0) {
    return NextResponse.json({ error: `「${tag.name}」目前還沒有任何情報,先去市場大腦建幾筆再來綜合。` }, { status: 422 });
  }

  const intelLines = intel
    .map((r, i) => {
      const src = `${SOURCE_TYPE_TXT[r.source_type] ?? r.source_type}${r.source_name ? `/${r.source_name}` : ''}`;
      const date = r.published_at || '(未填日期)';
      const summary = (r.summary ?? '').slice(0, SUMMARY_CAP);
      return `${i + 1}. [${STANCE_TXT[r.stance] ?? r.stance}] ${src} ${date}
   標題:${r.title}
   摘要:${summary}`;
    })
    .join('\n\n');

  const userMessage = `【綜合標的】${tag.name}(分類:${tag.category})

【關於這個標的的情報(共 ${intel.length} 筆,來自不同來源)】
${intelLines}

請依你的角色,把上面多筆(多半多家券商/來源)觀點做一份多空綜合判斷,輸出 JSON。
- 只能根據上面清單推論;不同來源衝突要點出,不要硬壓成單一答案,也不要編清單外的數字。

JSON Schema:
${JSON.stringify(MARKET_SYNTHESIS_JSON_SCHEMA, null, 2)}

只回 JSON,不加任何前後說明文字。`;

  const client = getAnthropic();
  try {
    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' } as unknown as { type: 'enabled'; budget_tokens: number },
      system: [
        {
          type: 'text',
          text: MARKET_SYNTHESIS_PROMPT,
          cache_control: { type: 'ephemeral' },
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
      console.error('[market-synthesis] JSON parse failed:', textBlock.text.slice(0, 500));
      return NextResponse.json({ error: 'AI 回傳格式錯誤,無法解析 JSON' }, { status: 502 });
    }

    const validated = MarketSynthesisResponseSchema.safeParse(parsed);
    if (!validated.success) {
      console.error('[market-synthesis] Zod validation failed:', validated.error);
      return NextResponse.json({ error: 'AI 回傳結構不符:' + validated.error.message }, { status: 502 });
    }

    const usage = {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
    };

    return NextResponse.json({ data: validated.data, intel_count: intel.length, usage });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[market-synthesis] Claude error:', message);
    return NextResponse.json({ error: 'AI 服務暫時無法使用:' + message }, { status: 502 });
  }
}

function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text.trim();
}
