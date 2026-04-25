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
