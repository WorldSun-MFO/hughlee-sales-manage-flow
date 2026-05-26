'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // dev-only:把 supabase client 掛到 window,讓人可在 DevTools console
  // 直接 `await window.supabase.auth.signInWithPassword({ email, password })` 試登入。
  // 正式環境(NODE_ENV !== 'development')不會跑這段。
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    (window as unknown as { supabase: ReturnType<typeof createClient> }).supabase = createClient();
  }, []);

  async function signInWithGoogle() {
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-indigo-50 to-slate-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white font-bold text-2xl flex items-center justify-center mx-auto">沃</div>
        <h1 className="mt-5 font-semibold text-lg">WORLDSUN MEDDIC Pipeline</h1>
        <p className="mt-0.5 text-xs text-slate-400">沃勝聯合家族辦公室</p>
        <p className="mt-3 text-sm text-slate-500">請用公司 Google 帳號登入</p>
        <button
          onClick={signInWithGoogle}
          disabled={loading}
          className="mt-6 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-300 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-50 text-sm font-medium"
        >
          <svg className="w-5 h-5" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
            <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 13.9-5.5l-6.4-5.4C29.5 34.7 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.4 39.6 16.1 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.4 5.4C41.9 34.7 44 29.7 44 24c0-1.2-.1-2.3-.4-3.5z"/>
          </svg>
          {loading ? '登入中...' : '用 Google 登入'}
        </button>
        {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}
        <p className="mt-6 text-xs text-slate-400">首次登入會自動建立帳號。若需管理員權限,請聯繫既有管理員於後台升級。</p>
      </div>
    </main>
  );
}
