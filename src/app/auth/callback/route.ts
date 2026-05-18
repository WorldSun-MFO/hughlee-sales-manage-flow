import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';
  const oauthErr = searchParams.get('error');
  const oauthErrDesc = searchParams.get('error_description');

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
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (!error) return NextResponse.redirect(`${origin}${next}`);

  const msg = error.message || '';
  const status = (error as unknown as { status?: number }).status;
  const codeStr = (error as unknown as { code?: string }).code;
  const lower = msg.toLowerCase();
  const tech = `exchangeCodeForSession failed\nmessage=${msg}\nstatus=${status ?? '-'}\ncode=${codeStr ?? '-'}`;

  // 1) 公司網域限制(restrict_email_domain trigger,errcode 42501)
  if (
    msg.includes('wsgfo') ||
    msg.includes('未獲授權') ||
    msg.includes('沃勝') ||
    status === 403
  ) {
    return page({
      origin,
      advice:
        '你登入的 Google 帳號不是公司 @wsgfo.com 帳號,系統只開放公司帳號。\n' +
        '• 在 Google 帳號選擇頁,請改選你的公司帳號(或點「使用其他帳戶」輸入 @wsgfo.com)。\n' +
        '• 若瀏覽器預設登入的是個人 Gmail,請先登出個人帳號,或改用無痕視窗。',
      tech,
    });
  }

  // 2) PKCE / code verifier(內建瀏覽器、跨網域、Cookie 被擋)
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

  // 3) 其他(含 DB / 500)— 顯示原始訊息供診斷
  return page({
    origin,
    advice:
      '登入沒有成功。請截下方「技術細節」回報管理員,我們會立即處理。\n' +
      '可先嘗試:電腦版 Chrome 無痕視窗、直接輸入系統網址、確認用 @wsgfo.com 帳號登入。',
    tech,
  });
}
