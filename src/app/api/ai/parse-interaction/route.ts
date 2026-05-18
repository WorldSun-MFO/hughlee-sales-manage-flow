import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { IS_DEMO } from '@/lib/demo';
import { getAnthropic, AI_MODEL } from '@/lib/anthropic/client';
import { PLAYBOOK_KNOWLEDGE } from '@/lib/anthropic/playbook';
import { ParseInteractionResponseSchema, PARSE_INTERACTION_JSON_SCHEMA } from '@/lib/anthropic/schemas';

export const runtime = 'nodejs';
export const maxDuration = 300;                  // Vercel Pro 上限

interface ReqBody {
  dealId: string;
  userText: string;
}

export async function POST(request: Request) {
  if (IS_DEMO) return NextResponse.json({ error: 'demo 為唯讀環境' }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登入' }, { status: 401 });

  const body = (await request.json()) as ReqBody;
  if (!body.dealId || !body.userText?.trim()) {
    return NextResponse.json({ error: '缺少 dealId 或 userText' }, { status: 400 });
  }

  const { data: deal, error: dealErr } = await supabase
    .from('deals')
    .select('*, scores(*), score_notes(*), comments(id, body, created_at), deal_questions(question_key, answered), rm:profiles!deals_rm_id_fkey(full_name)')
    .eq('id', body.dealId)
    .single();

  if (dealErr || !deal) {
    return NextResponse.json({ error: '找不到該案件' }, { status: 404 });
  }

  const dealContext = compactDealContext(deal);
  const userMessage = `【案件目前狀態】
${dealContext}

【這次與客戶的互動】
${body.userText.trim()}

請分析這次互動內容,輸出 JSON。注意:
- 沒有具體證據的分數不要改
- 若使用者提到新的承諾/動作,更新 next_step_update。**若有多個動作,每個動作必須各自獨立一行(用換行分隔),絕對不要寫成「1. xxx 2. yyy」擠在同一行**——系統會把每一行拆成一筆可分別指派給不同人的任務,擠在一行會導致無法分派
- question_checkoffs 只勾「這次真的得到答案」的題目
- 若 MEDDIC 總分達到推進條件,stage_suggestion 才給值,否則 null

JSON Schema:
${JSON.stringify(PARSE_INTERACTION_JSON_SCHEMA, null, 2)}

只回 JSON,不加任何前後說明文字。`;

  const client = getAnthropic();
  try {
    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 16000,                          // 4.7 adaptive thinking 需要 headroom
      // SDK 0.68 型別還沒納入 'adaptive',cast 繞過(API 已 GA 接受)
      thinking: { type: 'adaptive' } as unknown as { type: 'enabled'; budget_tokens: number },
      system: [
        {
          type: 'text',
          text: PLAYBOOK_KNOWLEDGE,
          cache_control: { type: 'ephemeral' },   // Playbook 跨呼叫快取
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    });

    // 抽出文字內容
    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'AI 沒有回傳文字內容' }, { status: 502 });
    }

    // 解析 JSON(允許 Claude 包在 ```json ... ``` 區塊或前後帶說明文字)
    const jsonText = extractJSON(textBlock.text);
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e) {
      console.error('[parse-interaction] JSON parse failed:', jsonText);
      return NextResponse.json({ error: 'AI 回傳格式錯誤,無法解析 JSON' }, { status: 502 });
    }

    // 用 Zod 驗證
    const validated = ParseInteractionResponseSchema.safeParse(parsed);
    if (!validated.success) {
      console.error('[parse-interaction] Zod validation failed:', validated.error);
      return NextResponse.json({ error: 'AI 回傳結構不符:' + validated.error.message }, { status: 502 });
    }

    const usage = {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
    };

    return NextResponse.json({ data: validated.data, usage });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[parse-interaction] Claude error:', message);
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

function compactDealContext(deal: Record<string, unknown>): string {
  const scores = deal.scores as Record<string, number> | null;
  const comments = (deal.comments as Array<{ body: string; created_at: string }> | null) ?? [];
  const questions = (deal.deal_questions as Array<{ question_key: string; answered: boolean }> | null) ?? [];
  const notes = (deal.score_notes as Array<{ field: string; evidence: string; next_action: string }> | null) ?? [];
  const rm = deal.rm as { full_name: string } | null;

  const scoreLine = scores
    ? `MEDDIC: M${scores.m}/E${scores.e}/D1:${scores.d1}/D2:${scores.d2}/P${scores.p}/I${scores.i}/C1:${scores.c1}/C2:${scores.c2} 總分${(scores.m ?? 0)+(scores.e ?? 0)+(scores.d1 ?? 0)+(scores.d2 ?? 0)+(scores.p ?? 0)+(scores.i ?? 0)+(scores.c1 ?? 0)+(scores.c2 ?? 0)}/80`
    : 'MEDDIC: 尚未評分';

  const noteLines = notes.filter(n => n.evidence || n.next_action)
    .map(n => `- ${n.field}: ${n.evidence}${n.next_action ? ` (下一步: ${n.next_action})` : ''}`)
    .join('\n') || '(無筆記)';

  const askedKeys = questions.filter(q => q.answered).map(q => q.question_key);
  const askedLine = askedKeys.length > 0 ? `已釐清題目: ${askedKeys.join(', ')}` : '已釐清題目: (無)';

  const recentComments = comments
    .slice(-5)
    .map(c => `- [${c.created_at.slice(0, 10)}] ${c.body}`)
    .join('\n') || '(無歷史註解)';

  return `客戶: ${deal.name}
RM: ${rm?.full_name ?? '未指派'}
階段: ${deal.stage} | 客戶等級: ${deal.tier ?? '未分級'} | AUM: $${Number(deal.aum_usd ?? 0).toLocaleString('en-US')}
目標商品: ${deal.product ?? '(未定)'}
目前下一步: ${deal.next_step ?? '(無)'}
${scoreLine}

【各項筆記/證據】
${noteLines}

${askedLine}

【近 5 筆註解】
${recentComments}`;
}
