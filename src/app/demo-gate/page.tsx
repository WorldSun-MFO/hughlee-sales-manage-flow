'use client';
import { useState, type FormEvent } from 'react';

// DEMO 共用密碼閘門。middleware 在 IS_DEMO 且無有效 cookie 時把人導到這裡。
export default function DemoGatePage() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/demo-gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        // 整頁導向,讓 middleware 帶著新 cookie 重新判斷
        window.location.href = '/';
        return;
      }
      setError('密碼錯誤,請再試一次。');
    } catch {
      setError('連線失敗,請稍後再試。');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-indigo-50 to-slate-50">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white font-bold text-2xl flex items-center justify-center mx-auto">沃</div>
        <h1 className="mt-5 font-semibold text-lg">WORLDSUN MEDDIC Pipeline</h1>
        <p className="mt-0.5 text-xs text-slate-400">沃勝聯合家族辦公室 · 示範環境</p>
        <p className="mt-3 text-sm text-slate-500">這是一個示範環境(資料皆為虛構範例)。<br />請輸入存取密碼。</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="存取密碼"
          autoFocus
          className="mt-6 w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm text-center outline-none focus:border-indigo-400"
        />
        <button
          type="submit"
          disabled={loading || !password}
          className="mt-3 w-full inline-flex items-center justify-center px-4 py-2.5 bg-indigo-600 text-white rounded-lg disabled:opacity-50 text-sm font-medium hover:bg-indigo-700"
        >
          {loading ? '驗證中...' : '進入示範'}
        </button>
        {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}
      </form>
    </main>
  );
}
