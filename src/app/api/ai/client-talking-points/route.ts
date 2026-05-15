import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAnthropic, AI_MODEL } from '@/lib/anthropic/client';
import { CLIENT_AMMO_PROMPT } from '@/lib/anthropic/client-ammo-prompt';
import { ClientAmmoResponseSchema, CLIENT_AMMO_JSON_SCHEMA } from '@/lib/anthropic/schemas';

export const runtime = 'nodejs';
export const maxDuration = 300;

interface ReqBody {
  dealId?: string;
}

const RECENT_INTEL_LIMIT = 20;
const MAX_CANDIDATES = 25;
const SUMMARY_CAP = 280;

interface IntelRow {
  id: string;
  title: string;
  region: string;
  stance: string;
  summary: string | null;
  intel_tags?: Array<{ market_tags: { name: string; category: string } | null }> | null;
}

function intelLine(r: IntelRow): string {
  const tags = (r.intel_tags ?? [])
    .map(t => t.market_tags?.name)
    .filter(Boolean)
    .join('、');
  const summary = (r.summary ?? '').slice(0, SUMMARY_CAP);
  return `${r.id} | ${r.title} | 地區:${r.region} | 立場:${r.stance} | 標籤:${tags || '無'} | 摘要:${summary}`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登入' }, { status: 401 });

  const body = (await request.json()) as ReqBody;
  const dealId = body.dealId?.trim();
  if (!dealId) return NextResponse.json({ error: '缺少 dealId' }, { status: 400 });

  // 客戶背景(RLS 自動把關:無權限會查不到)
  const { data: deal, error: dealErr } = await supabase
    .from('deals')
    .select('id, name, product, stage, tier, aum_usd')
    .eq('id', dealId)
    .single();

  if (dealErr || !deal) {
    return NextResponse.json({ error: '找不到該客戶或無權限' }, { status: 404 });
  }

  // 候選情報:此客戶被明確關聯的 + 近期市場情報(全團隊共享可讀)
  const { data: linkedRows } = await supabase
    .from('intel_deal_links')
    .select('market_intel(id, title, region, stance, summary, intel_tags(market_tags(name, category)))')
    .eq('deal_id', dealId);

  const { data: recentRows } = await supabase
    .from('market_intel')
    .select('id, title, region, stance, summary, intel_tags(market_tags(name, category))')
    .order('created_at', { ascending: false })
    .limit(RECENT_INTEL_LIMIT);

  const byId = new Map<string, IntelRow>();
  const linked = (linkedRows ?? []) as unknown as Array<{ market_intel: IntelRow | IntelRow[] | null }>;
  for (const lr of linked) {
    const mi = Array.isArray(lr.market_intel) ? lr.market_intel[0] : lr.market_intel;
    if (mi?.id) byId.set(mi.id, mi);
  }
  for (const r of (recentRows ?? []) as unknown as IntelRow[]) {
    if (r?.id && !byId.has(r.id)) byId.set(r.id, r);
  }

  const candidates = Array.from(byId.values()).slice(0, MAX_CANDIDATES);
  if (candidates.length === 0) {
    return NextResponse.json({
      data: { has_relevant: false, overall: '情報庫目前沒有跟這位客戶相關的內容,先去市場大腦累積一些情報。', talking_points: [] },
    });
  }

  const allowedIntelIds = new Set(candidates.map(c => c.id));

  const userMessage = `【客戶背景】
客戶名:${deal.name}
目標商品:${deal.product || '(未定)'}
階段:${deal.stage} | 等級:${deal.tier ?? '未分級'} | AUM:$${Number(deal.aum_usd ?? 0).toLocaleString('en-US')}

【候選情報清單(intel_id | 標題 | 地區 | 立場 | 標籤 | 摘要)】
${candidates.map(intelLine).join('\n')}

請依你的角色,挑出最值得拿去跟「這位客戶」聊的話題並產出彈藥,輸出 JSON。
- intel_id 只能用上面清單裡出現過的字串,原樣使用。
- 沒有貼切的就 has_relevant=false、talking_points 空陣列,不要硬湊。

JSON Schema:
${JSON.stringify(CLIENT_AMMO_JSON_SCHEMA, null, 2)}

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
          text: CLIENT_AMMO_PROMPT,
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
      console.error('[client-talking-points] JSON parse failed:', textBlock.text.slice(0, 500));
      return NextResponse.json({ error: 'AI 回傳格式錯誤,無法解析 JSON' }, { status: 502 });
    }

    const validated = ClientAmmoResponseSchema.safeParse(parsed);
    if (!validated.success) {
      console.error('[client-talking-points] Zod validation failed:', validated.error);
      return NextResponse.json({ error: 'AI 回傳結構不符:' + validated.error.message }, { status: 502 });
    }

    // 防幻覺:只留清單內真實存在的情報
    const safePoints = validated.data.talking_points.filter(p => allowedIntelIds.has(p.intel_id));

    const usage = {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
    };

    return NextResponse.json({ data: { ...validated.data, talking_points: safePoints }, usage });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[client-talking-points] Claude error:', message);
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
