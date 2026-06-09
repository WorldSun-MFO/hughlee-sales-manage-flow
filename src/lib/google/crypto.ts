// ============================================================
// Google refresh token 加密 / 解密(AES-256-GCM)
// ============================================================
// refresh token 是長期憑證,絕不可明碼落地。用 GOOGLE_TOKEN_ENC_KEY
// (32 bytes,以 64 字元 hex 提供:openssl rand -hex 32)做對稱加解密。
//
// 儲存格式:base64(iv) . base64(authTag) . base64(ciphertext)   (以 . 分隔)
// ============================================================
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

function getKey(): Buffer {
  const hex = process.env.GOOGLE_TOKEN_ENC_KEY;
  if (!hex) throw new Error('GOOGLE_TOKEN_ENC_KEY 未設定');
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) throw new Error('GOOGLE_TOKEN_ENC_KEY 必須是 32 bytes(64 字元 hex)');
  return key;
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12); // GCM 建議 12 bytes
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.');
}

export function decryptToken(stored: string): string {
  const [ivB64, tagB64, dataB64] = stored.split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('token 密文格式錯誤');
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
