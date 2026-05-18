// ============================================================
// DEMO 模式開關 — 唯一來源
// ============================================================
// 只有當 Vercel demo 專案設了 NEXT_PUBLIC_DEMO_MODE=true 時才為 true。
// 正式環境不會有這個環境變數 → IS_DEMO 永遠 false →
// 全站所有 `if (IS_DEMO)` 分支都是死碼,正式行為 100% 不受影響。
//
// NEXT_PUBLIC_ 前綴:server(page/middleware/route)與 client(components)
// 兩邊都讀得到,確保 demo 判斷在前後端一致。
export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

// demo 密碼閘門的 cookie 名稱與簽章用途字串(改這裡兩邊要一起改)
export const DEMO_COOKIE = 'ws_demo_access';
export const DEMO_TOKEN_PURPOSE = 'worldsun-demo-gate-v1';

// 用 Web Crypto 算出 cookie 應有的 token(edge middleware 與 node route 都可用)。
// 只有知道 DEMO_PASSWORD 的人,送出後才會拿到這個 token,無法偽造。
export async function demoAccessToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`${password}::${DEMO_TOKEN_PURPOSE}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
