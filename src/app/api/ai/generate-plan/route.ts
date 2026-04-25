import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAnthropic, AI_MODEL } from '@/lib/anthropic/client';
import { PLAYBOOK_KNOWLEDGE } from '@/lib/anthropic/playbook';
import { GeneratePlanResponseSchema, GENERATE_PLAN_JSON_SCHEMA } from '@/lib/anthropic/schemas';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface ReqBody {
  dealId: string;
  targetCloseDate: string;
  extraContext?: string;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登入' }, { status: 401 });

  const body = (await request.json()) as ReqBody;
  if (!body.dealId || !body.targetCloseDate) {
    return NextResponse.json({ error: '缺少 dealId 或 targetCloseDate' }, { status: 400 });
  }

  const { data: deal, error: dealErr } = await supabase
    .from('deals')
    .select('*, scores(*), score_notes(*), comments(id, body, created_at), deal_questions(question_key, answered), rm:profiles!deals_rm_id_fkey(full_name)')
    .eq('id', body.dealId)
    .single();

  if (dealErr || !deal) {
    return NextResponse.json({ error: '找不到該案件' }, { status: 404 });
  }

  const today = new Date();
  const targetDate = new Date(body.targetCloseDate);
  const daysUntil = Math.ceil((targetDate.getTime() - today.getTime()) / 86400000);

  if (daysUntil < 1) {
    return NextResponse.json({ error: '目標成交日必須在今天之後' }, { status: 400 });
  }

  const dealContext = compactDealContext(deal);
  const userMessage = `【案件目前狀態】
${dealContext}

【成交目標】
- 目標成交日: ${body.targetCloseDate}
- 距今天數: ${daysUntil} 天
${body.extraContext ? `\n【額外指示】\n${body.extraContext.trim()}` : ''}

請設計一條完整的成交路徑,輸出 JSON。要求:
1. 先給 feasibility (high/medium/low) 與理由(誠實,核保 8 週需求若目標 3 週內就標 low)
2. 分 3-8 個里程碑,每步有明確階段轉換、具體動作、話術、風險
3. 步驟時間要務實(考量核保、開戶、融資審批週數)
4. 話術是可以直接講出口的具體句子
5. 若某 MEDDIC 字母分數過低(例如 E < 4),早期步驟必須處理該弱項
6. 全部用繁體中文

JSON Schema:
${JSON.stringify(GENERATE_PLAN_JSON_SCHEMA, null, 2)}

只回 JSON,不加任何前後說明文字。`;

  const client = getAnthropic();
  try {
    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 32000,                          // 4.7 adaptive thinking + 完整成交路徑需要 headroom
      // SDK 0.68 型別還沒納入 'adaptive',cast 繞過(API 已 GA 接受)
      thinking: { type: 'adaptive' } as unknown as { type: 'enabled'; budget_tokens: number },
      system: [
        {
          type: 'text',
          text: PLAYBOOK_KNOWLEDGE,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'AI 沒有回傳文字內容' }, { status: 502 });
    }

    const jsonText = extractJSON(textBlock.text);
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e) {
      console.error('[generate-plan] JSON parse failed:', jsonText);
      return NextResponse.json({ error: 'AI 回傳格式錯誤,無法解析 JSON' }, { status: 502 });
    }

    const validated = GeneratePlanResponseSchema.safeParse(parsed);
    if (!validated.success) {
      console.error('[generate-plan] Zod validation failed:', validated.error);
      return NextResponse.json({ error: 'AI 回傳結構不符:' + validated.error.message }, { status: 502 });
    }

    const v = validated.data;

    const plan = {
      target_date: body.targetCloseDate,
      generated_at: new Date().toISOString(),
      model: AI_MODEL,
      overview: v.overview,
      feasibility: v.feasibility,
      feasibility_reason: v.feasibility_reason,
      top_risks: v.top_risks,
      steps: v.steps.map(s => ({ ...s, completed: false, completed_at: null })),
    };

    const usage = {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
    };

    return NextResponse.json({ data: plan, usage });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[generate-plan] Claude error:', message);
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
  const askedLine = askedKeys.length > 0 ? `已釐清題目: ${askedKeys.join(', ')}` : '已釐清題目: (無 — 深度探詢不足)';

  const recentComments = comments
    .slice(-8)
    .map(c => `- [${c.created_at.slice(0, 10)}] ${c.body}`)
    .join('\n') || '(無歷史註解)';

  return `客戶: ${deal.name}
RM: ${rm?.full_name ?? '未指派'}
階段: ${deal.stage} | 客戶等級: ${deal.tier ?? '未分級'} | AUM: $${Number(deal.aum_usd ?? 0).toLocaleString('en-US')}
目標商品: ${deal.product ?? '(未定)'}
首次接觸: ${deal.first_contact}
最後聯繫: ${deal.last_contact_at ? String(deal.last_contact_at).slice(0, 10) : '(未記錄)'}
目前下一步: ${deal.next_step ?? '(無)'}
${scoreLine}

【各項筆記/證據】
${noteLines}

${askedLine}

【歷史互動紀錄(近 8 筆)】
${recentComments}`;
}
