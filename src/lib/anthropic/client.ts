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

// ============================================================
// 模型選擇 — 依功能挑模型(成本/速度 vs 推理深度)
// ============================================================
// 主力(需深度判斷):parse-interaction / generate-plan / market-synthesis /
//   client-talking-points → Opus 4.7。
// 輕量(結構化抽取,不需深度推理):market-parse → Haiku 4.5(快又便宜)。
//
// Opus 4.7:最強的推理 + 中文 + 結構化輸出。搭配 adaptive thinking 自行決定推理深度。
export const AI_MODEL = 'claude-opus-4-7';

// Haiku 4.5:延遲低、成本低,適合「把原文濃縮成 JSON」這類結構化抽取任務。
export const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
