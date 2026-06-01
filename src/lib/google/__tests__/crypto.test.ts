// ============================================================
// lib/google/crypto.ts 單元測試
// ============================================================
// refresh token 是長期憑證,加解密一旦壞掉,輕則同步失效、重則 token 外流。
// 這裡驗三件事:
//   1) round-trip:加密再解密能還原原文(含中文 / 長字串)
//   2) 每次加密的密文不同(隨機 IV)→ 沒有把 IV 寫死
//   3) 竄改密文會被 GCM authTag 擋下(解密 throw)→ 防偽造
//
// 用一把固定測試金鑰(vi.stubEnv),不碰真正的 GOOGLE_TOKEN_ENC_KEY。
// ============================================================
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// 64 字元 hex = 32 bytes,符合 AES-256 金鑰長度
const TEST_KEY = '0'.repeat(64);

beforeAll(() => {
  vi.stubEnv('GOOGLE_TOKEN_ENC_KEY', TEST_KEY);
});
afterAll(() => {
  vi.unstubAllEnvs();
});

// 動態 import:確保 stubEnv 先生效(crypto.ts 在 getKey() 時才讀 env,故其實
// 靜態 import 也可,但動態 import 最保險)
async function loadCrypto() {
  return import('@/lib/google/crypto');
}

describe('google/crypto', () => {
  it('round-trip 能還原原文', async () => {
    const { encryptToken, decryptToken } = await loadCrypto();
    const plain = '1//0gXyZ-refresh-token_範例_with_中文_and_symbols!@#$%^&*()';
    expect(decryptToken(encryptToken(plain))).toBe(plain);
  });

  it('同一明文每次加密產生不同密文(隨機 IV)', async () => {
    const { encryptToken, decryptToken } = await loadCrypto();
    const plain = 'same-token';
    const a = encryptToken(plain);
    const b = encryptToken(plain);
    expect(a).not.toBe(b);
    // 但都能解回同一原文
    expect(decryptToken(a)).toBe(plain);
    expect(decryptToken(b)).toBe(plain);
  });

  it('竄改密文會被 GCM authTag 擋下', async () => {
    const { encryptToken, decryptToken } = await loadCrypto();
    const enc = encryptToken('secret');
    const [iv, tag, data] = enc.split('.');
    // 翻轉密文最後一個 base64 字元
    const flipped = data.slice(0, -1) + (data.endsWith('A') ? 'B' : 'A');
    expect(() => decryptToken([iv, tag, flipped].join('.'))).toThrow();
  });

  it('格式不對的密文會 throw', async () => {
    const { decryptToken } = await loadCrypto();
    expect(() => decryptToken('not-a-valid-blob')).toThrow('格式錯誤');
  });
});
