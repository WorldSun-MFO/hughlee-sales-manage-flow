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

// 預設模型 — Sonnet 4.6 在中文理解 + 結構化輸出上表現最好,cost/quality 平衡
export const AI_MODEL = 'claude-sonnet-4-6';
