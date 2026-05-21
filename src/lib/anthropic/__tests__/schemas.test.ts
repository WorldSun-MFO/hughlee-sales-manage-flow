// ============================================================
// lib/anthropic/schemas.ts 單元測試
// ============================================================
// 測試 Zod schemas — AI route 拿到 Anthropic 回應後的最後一道防線。
// 我們不是測 Anthropic 本身,而是測「萬一 AI 給亂的格式,Zod 擋得住」。
//
// 為什麼這層測試很值得寫:
//   - Anthropic 偶爾會多/少欄位,Zod 是 boundary defense
//   - 改 schema 時可立刻知道哪個 AI feature 會壞
//   - 不需要打 API,純 schema validation
//
// 跑法:npm run test
// ============================================================
import { describe, it, expect } from 'vitest';
import {
  ParseInteractionResponseSchema,
  GeneratePlanResponseSchema,
  MarketParseResponseSchema,
  ClientAmmoResponseSchema,
} from '@/lib/anthropic/schemas';

// ============================================================
// ParseInteractionResponseSchema — AIChatModal 用
// ============================================================
describe('ParseInteractionResponseSchema', () => {
  const validResponse = {
    summary: '今天跟陳董談加碼',
    score_updates: [
      { field: 'e', old: 4, new: 7, reason: '陳董口頭確認太太點頭' },
    ],
    new_comment: '陳董願意加碼,太太點頭,下週見面',
    next_step_update: '下週三 10:00 約陳董夫妻喝咖啡',
    question_checkoffs: ['e_spouse_meet'],
    stage_suggestion: 'L4',
    ask_back: ['太太的擔憂是什麼?', '加碼幅度?'],
  };

  it('完整合法 AI 回應通過', () => {
    const r = ParseInteractionResponseSchema.safeParse(validResponse);
    expect(r.success).toBe(true);
  });

  it('score > 10 應該被擋', () => {
    const r = ParseInteractionResponseSchema.safeParse({
      ...validResponse,
      score_updates: [{ field: 'e', old: 4, new: 11, reason: '...' }],
    });
    expect(r.success).toBe(false);
  });

  it('score < 0 應該被擋', () => {
    const r = ParseInteractionResponseSchema.safeParse({
      ...validResponse,
      score_updates: [{ field: 'e', old: 4, new: -1, reason: '...' }],
    });
    expect(r.success).toBe(false);
  });

  it('不在 MEDDIC 字母清單的 field 應該被擋', () => {
    const r = ParseInteractionResponseSchema.safeParse({
      ...validResponse,
      score_updates: [{ field: 'x', old: 4, new: 7, reason: '...' }],
    });
    expect(r.success).toBe(false);
  });

  it('next_step_update 可以是 null(無變化)', () => {
    const r = ParseInteractionResponseSchema.safeParse({
      ...validResponse,
      next_step_update: null,
    });
    expect(r.success).toBe(true);
  });

  it('stage_suggestion 可以是 null', () => {
    const r = ParseInteractionResponseSchema.safeParse({
      ...validResponse,
      stage_suggestion: null,
    });
    expect(r.success).toBe(true);
  });

  it('stage_suggestion 不在 L1-L7 應該被擋', () => {
    const r = ParseInteractionResponseSchema.safeParse({
      ...validResponse,
      stage_suggestion: 'L9',
    });
    expect(r.success).toBe(false);
  });

  it('缺 summary 應該被擋', () => {
    const { summary, ...rest } = validResponse;
    void summary;
    const r = ParseInteractionResponseSchema.safeParse(rest);
    expect(r.success).toBe(false);
  });

  it('score_updates 給空陣列也合法', () => {
    const r = ParseInteractionResponseSchema.safeParse({
      ...validResponse,
      score_updates: [],
    });
    expect(r.success).toBe(true);
  });
});

// ============================================================
// GeneratePlanResponseSchema — PlanModal 用
// ============================================================
describe('GeneratePlanResponseSchema', () => {
  const makeStep = (i: number) => ({
    id: `s${i}`,
    title: `Step ${i}`,
    target_date: '2026-06-01',
    stage_transition: 'L3→L4',
    focus: ['約客戶'],
    talking_points: ['話術'],
    risks: ['風險'],
  });

  const validResponse = {
    overview: '整體策略',
    feasibility: 'high',
    feasibility_reason: '時間充裕',
    top_risks: ['EB 未確認'],
    steps: [makeStep(1), makeStep(2), makeStep(3)],
  };

  it('合法回應通過', () => {
    const r = GeneratePlanResponseSchema.safeParse(validResponse);
    expect(r.success).toBe(true);
  });

  it('feasibility 不在 high/medium/low 被擋', () => {
    const r = GeneratePlanResponseSchema.safeParse({ ...validResponse, feasibility: 'maybe' });
    expect(r.success).toBe(false);
  });

  it('steps 少於 3 被擋(min 3)', () => {
    const r = GeneratePlanResponseSchema.safeParse({
      ...validResponse,
      steps: [makeStep(1), makeStep(2)],
    });
    expect(r.success).toBe(false);
  });

  it('steps 超過 8 被擋(max 8)', () => {
    const r = GeneratePlanResponseSchema.safeParse({
      ...validResponse,
      steps: Array.from({ length: 9 }, (_, i) => makeStep(i + 1)),
    });
    expect(r.success).toBe(false);
  });

  it('steps 剛好 8 應該通過(邊界)', () => {
    const r = GeneratePlanResponseSchema.safeParse({
      ...validResponse,
      steps: Array.from({ length: 8 }, (_, i) => makeStep(i + 1)),
    });
    expect(r.success).toBe(true);
  });
});

// ============================================================
// MarketParseResponseSchema — Market Intel 新增情報用
// ============================================================
describe('MarketParseResponseSchema', () => {
  const validResponse = {
    title: 'TSMC 法說會重點',
    region: 'TW',
    stance: 'bullish',
    summary: '台積電法說...'.padEnd(350, '·'),
    key_points: ['CoWoS 產能擴張', 'AI 訂單持續'],
    source_name: '某券商',
    author: '分析師甲',
    tags: [{ category: 'ticker', name: 'TSMC' }],
    suggested_deal_links: [{ deal_id: 'd1', relevance_reason: '客戶持有台積電部位' }],
  };

  it('合法回應通過', () => {
    const r = MarketParseResponseSchema.safeParse(validResponse);
    expect(r.success).toBe(true);
  });

  it('region 不在清單被擋', () => {
    const r = MarketParseResponseSchema.safeParse({ ...validResponse, region: 'EU' });
    expect(r.success).toBe(false);
  });

  it('stance 不在 bullish/bearish/neutral/na 被擋', () => {
    const r = MarketParseResponseSchema.safeParse({ ...validResponse, stance: 'unsure' });
    expect(r.success).toBe(false);
  });

  it('tag category 不合法被擋', () => {
    const r = MarketParseResponseSchema.safeParse({
      ...validResponse,
      tags: [{ category: 'random', name: 'X' }],
    });
    expect(r.success).toBe(false);
  });

  it('空 tag 名(min 1)被擋', () => {
    const r = MarketParseResponseSchema.safeParse({
      ...validResponse,
      tags: [{ category: 'ticker', name: '' }],
    });
    expect(r.success).toBe(false);
  });

  it('suggested_deal_links 給空陣列也合法(寧缺勿濫)', () => {
    const r = MarketParseResponseSchema.safeParse({ ...validResponse, suggested_deal_links: [] });
    expect(r.success).toBe(true);
  });
});

// ============================================================
// ClientAmmoResponseSchema — DealDetail ClientAmmoCard 用
// ============================================================
describe('ClientAmmoResponseSchema', () => {
  const validResponse = {
    has_relevant: true,
    overall: '可從台積電法說切入',
    talking_points: [
      {
        hook: '台積電法說超預期',
        angle: '客戶持有部位,適合提分散',
        opener: '陳董早\n剛剛看完台積電法說',
        intel_id: 'intel-1',
        intel_title: 'TSMC 法說會重點',
        caution: '',
      },
    ],
  };

  it('合法回應通過', () => {
    const r = ClientAmmoResponseSchema.safeParse(validResponse);
    expect(r.success).toBe(true);
  });

  it('has_relevant=false + talking_points=[] 也合法', () => {
    const r = ClientAmmoResponseSchema.safeParse({
      has_relevant: false,
      overall: '目前沒有貼切的市場話題',
      talking_points: [],
    });
    expect(r.success).toBe(true);
  });

  it('缺 caution 欄位被擋(即使空字串也得寫出來)', () => {
    const incomplete = { ...validResponse.talking_points[0] };
    delete (incomplete as Partial<typeof incomplete>).caution;
    const r = ClientAmmoResponseSchema.safeParse({
      ...validResponse,
      talking_points: [incomplete],
    });
    expect(r.success).toBe(false);
  });
});
