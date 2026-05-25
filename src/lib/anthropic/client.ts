// ============================================================
// Anthropic SDK client(整個系統唯一的 AI 入口)
// ============================================================
// 為什麼用 singleton getter:
//   - SDK 物件創建有成本(讀環境變數、建 http agent),route 端每次 hot
//     reload 重建沒有意義。模組層級 lazy init,第一次呼叫才建。
//   - 不能在模組頂層直接 new Anthropic({...}),因為 build 時不一定有
//     ANTHROPIC_API_KEY(Vercel preview / 本機 build)。
//
// 被誰呼叫:
//   - /api/ai/parse-interaction (AIChatModal)
//   - /api/ai/generate-plan     (PlanModal)
//   - /api/ai/market-parse      (Market Intel 新增情報時)
//   - /api/ai/market-synthesis  (Market Intel 多空綜合)
//   - /api/ai/client-talking-points (DealDetail 的 ClientAmmoCard)
//
// 不會被前端呼叫(API key 只能放 server)。
// ============================================================
import Anthropic from '@anthropic-ai/sdk';

let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

// Opus 4.7:最強的推理 + 中文 + 結構化輸出。適合 MFO 銷售策略這種需要深度判斷的場景。
// 搭配 adaptive thinking 讓模型自行決定推理深度,effort 預設 'high'。
export const AI_MODEL = 'claude-opus-4-7';
