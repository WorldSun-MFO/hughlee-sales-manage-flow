// ============================================================
// AI route 的輸入輸出契約 — JSON Schema + Zod 雙保險
// ============================================================
// 每個 AI feature 都有兩份 schema:
//   FOO_JSON_SCHEMA      → 送給 Anthropic API,讓模型強制依結構輸出
//   FooResponseSchema    → 收到回應後用 Zod 二次驗證
// 雙保險原因:Anthropic 偶爾會多/少欄位,Zod 是最後一道防線。
//
// 對應的 route:
//   PARSE_INTERACTION  ←→ /api/ai/parse-interaction  ←→ AIChatModal
//   GENERATE_PLAN      ←→ /api/ai/generate-plan      ←→ PlanModal
//   MARKET_PARSE       ←→ /api/ai/market-parse       ←→ Market 新增情報
//   CLIENT_AMMO        ←→ /api/ai/client-talking-points ←→ DealDetail ClientAmmoCard
//   MARKET_SYNTHESIS   ←→ /api/ai/market-synthesis   ←→ /market/synthesis
//
// 改 schema 時一定要兩邊同步,不然 Zod 會擋掉合法 AI 回應。
// ============================================================
import { z } from 'zod';

// ====== Feature A: Parse Interaction ======
export const MEDDIC_FIELDS = ['m', 'e', 'd1', 'd2', 'p', 'i', 'c1', 'c2'] as const;
export const STAGES = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'] as const;

// ====== Raw JSON Schemas (送給 Anthropic API,讓它強制輸出此結構) ======
export const PARSE_INTERACTION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: '一句話總結這次對話的重點' },
    score_updates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          field: { type: 'string', enum: [...MEDDIC_FIELDS] },
          old: { type: 'integer', minimum: 0, maximum: 10 },
          new: { type: 'integer', minimum: 0, maximum: 10 },
          reason: { type: 'string' },
        },
        required: ['field', 'old', 'new', 'reason'],
        additionalProperties: false,
      },
    },
    new_comment: { type: 'string', description: '要加到註解時間軸的文字摘要' },
    next_step_update: { type: ['string', 'null'], description: '下一步具體動作。若有多個動作,每個動作各自獨立一行(以換行符號分隔),不要寫成「1. xxx 2. yyy」全部擠在同一行。若這次互動沒有新的下一步,給 null' },
    question_checkoffs: { type: 'array', items: { type: 'string' } },
    stage_suggestion: { type: ['string', 'null'], enum: [...STAGES, null] },
    ask_back: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'score_updates', 'new_comment', 'next_step_update', 'question_checkoffs', 'stage_suggestion', 'ask_back'],
  additionalProperties: false,
} as const;

export const GENERATE_PLAN_JSON_SCHEMA = {
  type: 'object',
  properties: {
    overview: { type: 'string', description: '整體策略分析' },
    feasibility: { type: 'string', enum: ['high', 'medium', 'low'] },
    feasibility_reason: { type: 'string' },
    top_risks: { type: 'array', items: { type: 'string' } },
    steps: {
      type: 'array',
      minItems: 3,
      maxItems: 8,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          target_date: { type: 'string', description: 'YYYY-MM-DD' },
          stage_transition: { type: 'string' },
          focus: { type: 'array', items: { type: 'string' } },
          talking_points: { type: 'array', items: { type: 'string' } },
          risks: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'title', 'target_date', 'stage_transition', 'focus', 'talking_points', 'risks'],
        additionalProperties: false,
      },
    },
  },
  required: ['overview', 'feasibility', 'feasibility_reason', 'top_risks', 'steps'],
  additionalProperties: false,
} as const;

export const ScoreUpdateSchema = z.object({
  field: z.enum(MEDDIC_FIELDS),
  old: z.number().int().min(0).max(10),
  new: z.number().int().min(0).max(10),
  reason: z.string().describe('為什麼分數要這樣改,用一句話講清楚'),
});

export const ParseInteractionResponseSchema = z.object({
  summary: z.string().describe('一句話總結這次對話的重點'),
  score_updates: z.array(ScoreUpdateSchema).describe('建議的 MEDDIC 分數變更,沒有就給空陣列'),
  new_comment: z.string().describe('要加到註解時間軸的文字摘要(含關鍵事實)'),
  next_step_update: z.string().nullable().describe('新的下一步動作;有多個動作時每項各自獨立一行(換行分隔),不可串在同一行;若無變化給 null'),
  question_checkoffs: z.array(z.string()).describe('已釐清的題庫 key (例 m_aum, e_spouse_meet);沒有給空陣列'),
  stage_suggestion: z.enum(STAGES).nullable().describe('若這次對話足以推進階段,建議新階段;否則 null'),
  ask_back: z.array(z.string()).describe('AI 建議 RM 下次要追問的 2-3 個問題(讓 MEDDIC 更完整)'),
});

export type ParseInteractionResponse = z.infer<typeof ParseInteractionResponseSchema>;

// ====== Feature B: Generate Plan ======
export const PlanStepSchema = z.object({
  id: z.string().describe('步驟唯一識別 (s1, s2...)'),
  title: z.string().describe('步驟標題'),
  target_date: z.string().describe('建議完成日期 YYYY-MM-DD'),
  stage_transition: z.string().describe('此步驟要推進的階段轉換,例如 L3→L4;或 L4 內部'),
  focus: z.array(z.string()).describe('核心動作(要做什麼),2-4 條'),
  talking_points: z.array(z.string()).describe('具體話術或提問,2-4 條'),
  risks: z.array(z.string()).describe('這步可能卡關的地方,1-3 條'),
});

export const GeneratePlanResponseSchema = z.object({
  overview: z.string().describe('整體策略分析,說明依目前狀態設計這條路徑的邏輯'),
  feasibility: z.enum(['high', 'medium', 'low']).describe('達成目標日的可行性評估'),
  feasibility_reason: z.string().describe('可行性評估的理由(例:核保至少 8 週,目標日 6 週內屬樂觀)'),
  top_risks: z.array(z.string()).describe('整體 3 個最大風險(不是單步驟的)'),
  steps: z.array(PlanStepSchema).min(3).max(8).describe('分 3-8 步驟(不要過細,每步是一個明確的里程碑)'),
});

export type GeneratePlanResponse = z.infer<typeof GeneratePlanResponseSchema>;

// ====== Feature C: Market Intel Parse(金融資訊大腦)======
export const INTEL_REGIONS = ['TW', 'US', 'JP', 'CN', 'GLOBAL'] as const;
export const INTEL_STANCES = ['bullish', 'bearish', 'neutral', 'na'] as const;
export const TAG_CATEGORIES = ['region', 'industry', 'ticker', 'macro', 'theme'] as const;

export const MARKET_PARSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: '一句話可掃讀的標題' },
    region: { type: 'string', enum: [...INTEL_REGIONS] },
    stance: { type: 'string', enum: [...INTEL_STANCES] },
    summary: { type: 'string', description: '300–500 字摘要,完整段落' },
    key_points: { type: 'array', items: { type: 'string' }, description: '3–6 條重點' },
    source_name: { type: 'string', description: '出處;辨識不出給空字串' },
    author: { type: 'string', description: '分析師/作者;辨識不出給空字串' },
    tags: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: [...TAG_CATEGORIES] },
          name: { type: 'string' },
        },
        required: ['category', 'name'],
        additionalProperties: false,
      },
    },
    suggested_deal_links: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          deal_id: { type: 'string', description: '必須原封不動使用清單給的 id' },
          relevance_reason: { type: 'string' },
        },
        required: ['deal_id', 'relevance_reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'region', 'stance', 'summary', 'key_points', 'source_name', 'author', 'tags', 'suggested_deal_links'],
  additionalProperties: false,
} as const;

export const MarketTagSuggestionSchema = z.object({
  category: z.enum(TAG_CATEGORIES),
  name: z.string().min(1),
});

export const MarketDealLinkSuggestionSchema = z.object({
  deal_id: z.string().min(1),
  relevance_reason: z.string(),
});

export const MarketParseResponseSchema = z.object({
  title: z.string().describe('一句話可掃讀的標題'),
  region: z.enum(INTEL_REGIONS),
  stance: z.enum(INTEL_STANCES),
  summary: z.string().describe('300–500 字摘要'),
  key_points: z.array(z.string()).describe('3–6 條重點;沒有給空陣列'),
  source_name: z.string().describe('出處;辨識不出給空字串'),
  author: z.string().describe('分析師/作者;辨識不出給空字串'),
  tags: z.array(MarketTagSuggestionSchema).describe('3–8 個標籤;個股必標'),
  suggested_deal_links: z
    .array(MarketDealLinkSuggestionSchema)
    .describe('建議關聯客戶;寧缺勿濫,不相關給空陣列'),
});

export type MarketParseResponse = z.infer<typeof MarketParseResponseSchema>;

// ====== Feature D: Client Talking Points(客戶彈藥庫)======
export const CLIENT_AMMO_JSON_SCHEMA = {
  type: 'object',
  properties: {
    has_relevant: { type: 'boolean', description: '是否有貼切可聊的市場話題' },
    overall: { type: 'string', description: '一句話總評:這客戶現在市場面可切入的角度;沒有就說明為何沒有' },
    talking_points: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          hook: { type: 'string', description: '話題切入點(標題式)' },
          angle: { type: 'string', description: '為何對這位客戶有意義(扣商品/階段/痛點)' },
          opener: { type: 'string', description: 'Hugh 拆段風格多則短訊息,以 \\n 分行,第一則含稱呼+hook' },
          intel_id: { type: 'string', description: '依據哪則情報;必須原樣使用清單給的 id' },
          intel_title: { type: 'string', description: '該情報標題' },
          caution: { type: 'string', description: '碰到紅線時的提醒(需 Hugh 親自確認/手寫的原因);無則空字串' },
        },
        required: ['hook', 'angle', 'opener', 'intel_id', 'intel_title', 'caution'],
        additionalProperties: false,
      },
    },
  },
  required: ['has_relevant', 'overall', 'talking_points'],
  additionalProperties: false,
} as const;

export const ClientTalkingPointSchema = z.object({
  hook: z.string(),
  angle: z.string(),
  opener: z.string().describe('Hugh 拆段風格,多則短訊息以 \\n 分行'),
  intel_id: z.string(),
  intel_title: z.string(),
  caution: z.string().describe('紅線提醒;無則空字串'),
});

export const ClientAmmoResponseSchema = z.object({
  has_relevant: z.boolean(),
  overall: z.string(),
  talking_points: z.array(ClientTalkingPointSchema).describe('通常 2–4 個,最多 5;不相關給空陣列'),
});

export type ClientAmmoResponse = z.infer<typeof ClientAmmoResponseSchema>;

// ====== Feature E: Market Synthesis(多券商多空綜合)======
export const SYNTHESIS_STANCES = ['bullish', 'bearish', 'neutral', 'mixed'] as const;

export const MARKET_SYNTHESIS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    consensus_stance: { type: 'string', enum: [...SYNTHESIS_STANCES] },
    summary: { type: 'string', description: '200–400 字綜合判斷' },
    bull_points: { type: 'array', items: { type: 'string' }, description: '多方核心論點;沒有給空陣列' },
    bear_points: { type: 'array', items: { type: 'string' }, description: '空方核心論點;沒有給空陣列' },
    divergence: { type: 'string', description: '多空最關鍵分歧點(一兩句)' },
    watch_items: { type: 'array', items: { type: 'string' }, description: '要追蹤的訊號/數據/時間點 2–4 條' },
    wsg_implication: { type: 'string', description: '對 WORLDSUN 客戶/商品的意涵(務實,不喊單)' },
  },
  required: ['consensus_stance', 'summary', 'bull_points', 'bear_points', 'divergence', 'watch_items', 'wsg_implication'],
  additionalProperties: false,
} as const;

export const MarketSynthesisResponseSchema = z.object({
  consensus_stance: z.enum(SYNTHESIS_STANCES),
  summary: z.string(),
  bull_points: z.array(z.string()),
  bear_points: z.array(z.string()),
  divergence: z.string(),
  watch_items: z.array(z.string()),
  wsg_implication: z.string(),
});

export type MarketSynthesisResponse = z.infer<typeof MarketSynthesisResponseSchema>;
