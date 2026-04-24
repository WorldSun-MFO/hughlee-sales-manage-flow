import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAnthropic, AI_MODEL } from '@/lib/anthropic/client';
import { PLAYBOOK_KNOWLEDGE } from '@/lib/anthropic/playbook';
import { ParseInteractionResponseSchema } from '@/lib/anthropic/schemas';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface ReqBody {
  dealId: string;
  userText: string;
}

export async function POST(request: Request) {
  // 1. 驗證登入 + 抓 deal context
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
    return NextResponse.json({ error: '找不到該案件,或無權限存取' }, { status: 404 });
  }

  // 2. 組 user message(deal context 精簡 + 本次對話描述)
  // ⚠️ 不要把變動資料放進 system — 會打破 prompt cache
  const dealContext = compactDealContext(deal);
  const userMessage = `【案件目前狀態】
${dealContext}

【這次與客戶的互動】
${body.userText.trim()}

請分析這次互動內容,依 schema 輸出結構化建議。注意:
- 沒有具體證據的分數不要改
- 若使用者提到新的承諾/動作,update next_step_update
- question_checkoffs 只勾「這次真的得到答案」的題目
- 若 MEDDIC 總分或關鍵門檻達到推進條件,stage_suggestion 才給值,否則 null`;

  // 3. 呼叫 Claude,system prompt 加 cache_control 做前綴快取
  const client = getAnthropic();
  try {
    const msg = await client.messages.parse({
      model: AI_MODEL,
      max_tokens: 4000,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'medium',
        format: zodOutputFormat(ParseInteractionResponseSchema),
      },
      system: [
        {
          type: 'text',
          text: PLAYBOOK_KNOWLEDGE,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    });

    const parsed = msg.parsed_output;
    if (!parsed) {
      return NextResponse.json({ error: 'AI 解析失敗,未產出有效 JSON' }, { status: 502 });
    }

    // usage 資訊:回傳給前端做成本監控用
    const usage = {
      input_tokens: msg.usage.input_tokens,
      output_tokens: msg.usage.output_tokens,
      cache_read_input_tokens: msg.usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: msg.usage.cache_creation_input_tokens ?? 0,
    };

    return NextResponse.json({ data: parsed, usage });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[parse-interaction] Claude error:', message);
    return NextResponse.json({ error: 'AI 服務暫時無法使用:' + message }, { status: 502 });
  }
}

/** 把 deal 濃縮成 AI 能讀懂的精簡 context(只放該模型該看的欄位)。 */
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
