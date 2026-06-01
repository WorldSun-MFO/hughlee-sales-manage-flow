import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { storeRefreshToken } from '@/lib/google/calendar';

// 出錯時不再 silent 彈回 /login(那會造成不透明的無限循環)。
// 改為:成功 → 照舊導向 next;失敗 → 顯示一頁「真實原因 + 中文指引」,
// 並附技術細節供回報。所有反射內容皆 HTML escape,避免 XSS。

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function page(opts: { advice: string; tech: string; origin: string }): Response {
  const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>登入未完成 — WORLDSUN</title>
<style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Noto Sans TC","Segoe UI",sans-serif;background:#f1f5f9;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
.card{background:#fff;max-width:480px;width:100%;border:1px solid #e2e8f0;border-radius:16px;padding:28px;box-shadow:0 10px 30px rgba(0,0,0,.06)}
h1{font-size:18px;margin:0 0 4px}.sub{color:#64748b;font-size:13px;margin:0 0 18px}
.advice{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:10px;padding:14px;font-size:14px;line-height:1.75;white-space:pre-line}
.btn{display:inline-block;margin-top:18px;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600}
details{margin-top:16px}summary{cursor:pointer;color:#94a3b8;font-size:12px}
pre{background:#0f172a;color:#e2e8f0;font-size:11px;padding:12px;border-radius:8px;overflow:auto;margin-top:8px;white-space:pre-wrap;word-break:break-all}</style>
</head><body><div class="card">
<h1>登入未完成</h1>
<p class="sub">WORLDSUN MEDDIC Pipeline · 沃勝聯合家族辦公室</p>
<div class="advice">${esc(opts.advice)}</div>
<a class="btn" href="${esc(opts.origin)}/login">重新登入</a>
<details><summary>技術細節(截圖回報給管理員)</summary><pre>${esc(opts.tech)}</pre></details>
</div></body></html>`;
  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

// 一次性連結的「點此完成登入」中間頁。只渲染一個 POST 表單按鈕;
// 通訊軟體/Email 的網址預覽機器人只做 GET、不會送出表單,故一次性
// token 不會在真人點之前被消耗。真人按下按鈕 → POST → 才 verifyOtp。
function confirmPage(opts: {
  origin: string;
  tokenHash: string;
  otpType: string;
  next: string;
}): Response {
  const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>完成登入 — WORLDSUN</title>
<style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Noto Sans TC","Segoe UI",sans-serif;background:#f1f5f9;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
.card{background:#fff;max-width:460px;width:100%;border:1px solid #e2e8f0;border-radius:16px;padding:28px;box-shadow:0 10px 30px rgba(0,0,0,.06);text-align:center}
h1{font-size:18px;margin:0 0 6px}.sub{color:#64748b;font-size:13px;margin:0 0 22px}
.btn{display:inline-block;border:0;cursor:pointer;background:#4f46e5;color:#fff;padding:14px 30px;border-radius:10px;font-size:16px;font-weight:700}
.note{color:#94a3b8;font-size:12px;margin-top:18px;line-height:1.8}</style>
</head><body><div class="card">
<h1>完成登入</h1>
<p class="sub">WORLDSUN MEDDIC Pipeline · 沃勝聯合家族辦公室</p>
<form method="POST" action="${esc(opts.origin)}/auth/callback">
<input type="hidden" name="token_hash" value="${esc(opts.tokenHash)}">
<input type="hidden" name="type" value="${esc(opts.otpType)}">
<input type="hidden" name="next" value="${esc(opts.next)}">
<button class="btn" type="submit">點此完成登入 →</button>
</form>
<p class="note">為保護你的帳號,登入連結需在此再按一下才生效。<br>(這一步可避免連結被通訊軟體的網址預覽提前用掉)</p>
</div></body></html>`;
  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';
  const oauthErr = searchParams.get('error');
  const oauthErrDesc = searchParams.get('error_description');

  // 0) 一次性 Email 登入連結(管理員在「團隊成員」產生的 magic/invite 連結)。
  //    GET 時「不」直接 verifyOtp——LINE/Email 的網址預覽機器人會搶先 GET
  //    這個網址,若此處就 verifyOtp 會把一次性 token 燒掉,真人再點就失效
  //    (實測 auth log 10× otp_expired、session 全是伺服器 UA)。
  //    改為先回「點此完成登入」頁,只有真人按鈕送出的 POST 才 verifyOtp。
  //    權限仍由 DB 端 restrict_email_domain(白名單)把關。
  const tokenHash = searchParams.get('token_hash');
  const otpType = searchParams.get('type');
  if (tokenHash && otpType) {
    return confirmPage({ origin, tokenHash, otpType, next });
  }

  // Google 直接帶錯誤回來(取消授權 / 組織封鎖 / App 未授權…)
  if (oauthErr) {
    return page({
      origin,
      advice:
        'Google 端沒有完成授權。\n' +
        '• 若你按了「取消」,請重新登入並按「允許」。\n' +
        '• 若顯示帳號被組織封鎖,請聯繫管理員確認本系統已開放給你的帳號。',
      tech: `oauth_error=${oauthErr}\noauth_error_description=${oauthErrDesc ?? '-'}`,
    });
  }

  // 沒有 code:多半是內建瀏覽器/Cookie 把 PKCE code verifier 丟了
  if (!code) {
    return page({
      origin,
      advice:
        '沒有收到 Google 的授權碼,通常是「瀏覽器環境」問題:\n' +
        '• 請改用電腦版 Chrome,或手機 Safari / Chrome 的「一般視窗」。\n' +
        '• 不要在 LINE / Facebook / Instagram 的「內建瀏覽器」開啟本系統連結。\n' +
        '• 開無痕視窗,直接輸入系統網址後再登入(不要從舊分頁或別的網址跳轉)。',
      tech: 'no auth code in callback — likely in-app/embedded browser dropped the PKCE code verifier',
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (!error) {
    // 攔下 Google 的 refresh token,加密存起來供後續行事曆同步用。
    // Supabase 只在登入當下回傳一次 provider_refresh_token,之後不會再給;
    // 非致命:存失敗只記 log,絕不擋登入。
    try {
      const session = data.session;
      if (session?.provider_refresh_token && session.user?.id) {
        await storeRefreshToken(session.user.id, session.provider_refresh_token);
      }
    } catch (e) {
      console.error('[auth/callback] 存 Google refresh token 失敗(不影響登入):', e);
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  const msg = error.message || '';
  const status = (error as unknown as { status?: number }).status;
  const codeStr = (error as unknown as { code?: string }).code;
  const lower = msg.toLowerCase();
  const tech = `exchangeCodeForSession failed\nmessage=${msg}\nstatus=${status ?? '-'}\ncode=${codeStr ?? '-'}`;

  // 1) PKCE / code verifier(內建瀏覽器、跨網域、Cookie 被擋)
  //    必須排在網域判斷之前:LINE/FB/IG 內建瀏覽器丟失 code verifier 時
  //    Supabase 常回 403,若先用裸 status===403 判網域,會把這種「瀏覽器
  //    環境」失敗誤報成「你的帳號沒被授權」,讓使用者誤以為是權限問題。
  if (
    lower.includes('code verifier') ||
    lower.includes('code_verifier') ||
    lower.includes('both auth code') ||
    lower.includes('flow state') ||
    lower.includes('pkce') ||
    lower.includes('invalid request')
  ) {
    return page({
      origin,
      advice:
        '登入驗證資料在你的瀏覽器中遺失,通常是「內建瀏覽器 / Cookie」問題:\n' +
        '• 請用電腦版 Chrome,或手機 Safari / Chrome 的「一般視窗」,勿用 LINE/FB/IG 內建瀏覽器。\n' +
        '• 用無痕視窗,直接輸入系統網址後再登入。\n' +
        '• 確認瀏覽器沒有封鎖本網站的 Cookie。',
      tech,
    });
  }

  // 2) 公司網域 / 白名單限制(restrict_email_domain trigger,errcode 42501)
  //    只認該 trigger 的訊息字樣;不再用裸 status===403(那會把上面的
  //    PKCE / 內建瀏覽器失敗誤報成網域問題)。
  if (
    msg.includes('wsgfo') ||
    msg.includes('未獲授權') ||
    msg.includes('沃勝')
  ) {
    return page({
      origin,
      advice:
        '這個 Google 帳號目前沒有被授權登入本系統。\n' +
        '• 公司同仁:請改用 @wsgfo.com 公司帳號登入(在 Google 帳號頁選公司帳號,或用無痕視窗避免被個人 Gmail 佔用)。\n' +
        '• 外部協作者:請聯繫管理員,用「新增成員」把你的 email 預先建立;email 必須與你登入的 Google 帳號完全一致、全小寫。',
      tech,
    });
  }

  // 3) 其他(含 DB / 500)— 顯示原始訊息供診斷
  return page({
    origin,
    advice:
      '登入沒有成功。請截下方「技術細節」回報管理員,我們會立即處理。\n' +
      '可先嘗試:電腦版 Chrome 無痕視窗、直接輸入系統網址、確認用 @wsgfo.com 帳號登入。',
    tech,
  });
}

// 真人在「完成登入」頁按下按鈕才會走到這裡(POST)。網址預覽/爬蟲只做
// GET、不會送這個表單,故一次性 token 不會在真人點之前被消耗。
export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  const form = await request.formData();
  const tokenHash = String(form.get('token_hash') ?? '');
  const otpType = String(form.get('type') ?? '');
  const next = String(form.get('next') || '/');

  if (!tokenHash || !otpType) {
    return page({
      origin,
      advice: '登入資訊不完整,請向管理員(Hugh)索取一條新的登入連結。',
      tech: `missing on POST\ntoken_hash=${tokenHash ? 'present' : 'missing'}\ntype=${otpType || '-'}`,
    });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: otpType as EmailOtpType,
    token_hash: tokenHash,
  });
  if (!error) return NextResponse.redirect(`${origin}${next}`, { status: 303 });

  return page({
    origin,
    advice:
      '這條登入連結無法使用,通常是「已過期」或「已被用過一次」:\n' +
      '• 請向管理員(Hugh)索取一條新的登入連結,收到後盡快點開並按「完成登入」。\n' +
      '• 連結請用手機 Safari / Chrome 或電腦版 Chrome 的「一般視窗」開啟,勿用 LINE/FB/IG 內建瀏覽器。\n' +
      '• 同一條連結只能用一次。',
    tech:
      `verifyOtp failed (POST)\ntype=${otpType}\nmessage=${error.message}\n` +
      `status=${(error as unknown as { status?: number }).status ?? '-'}`,
  });
}
