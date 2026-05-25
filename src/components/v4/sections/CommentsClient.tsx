'use client';

// ============================================================
// 活動紀錄 — 寫筆記 + 時間軸列表(v4.1 fire-and-forget 版)
// ============================================================
// 之前:送出後 router.refresh() 等 server re-render(685ms,UI 卡頓)
// 現在:送出後直接把新 comment append 到本地 list,瞬間顯示;
//      DB 寫入背景跑,失敗回滾。
// ============================================================
import { useEffect, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import type { Comment, Profile } from '@/lib/v4/types';
import { cn, daysSince } from '@/lib/v4/utils';
import { addComment } from '@/lib/v4/mutations';
import { createClient } from '@/lib/supabase/client';

export function CommentsClient({
  dealId, comments: serverComments, profiles, isFixtures,
}: {
  dealId: string;
  comments: Comment[];
  profiles: Profile[];
  isFixtures: boolean;
}) {
  const [localComments, setLocalComments] = useState<Comment[]>(serverComments);
  // server snapshot 更新時(realtime / 重新進頁面)同步本地;有 pending 則保留
  useEffect(() => { setLocalComments(serverComments); }, [serverComments]);

  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    const body = text.trim();
    if (!body || busy) return;
    if (isFixtures) { setErr('fixtures 模式無法寫入'); return; }

    // optimistic prepend
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const tmpId = `tmp-${Date.now()}`;
    const optimistic: Comment = {
      id: tmpId,
      deal_id: dealId,
      author_id: user?.id ?? null,
      body,
      is_raw: false,
      is_system: false,
      created_at: new Date().toISOString(),
    };
    setLocalComments((prev) => [optimistic, ...prev]);
    setText('');
    setBusy(true); setErr(null);
    try {
      await addComment(dealId, body);
      // 成功就讓 optimistic 留著(server snapshot 下次刷新會帶真 id);不 router.refresh
    } catch (e) {
      setLocalComments((prev) => prev.filter((c) => c.id !== tmpId));
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-3">
      <div className="label-caps text-ink/55">活動紀錄 · {localComments.length}</div>

      <div className="grid gap-2 rounded-md border border-ink/10 bg-paper p-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="寫個筆記、補充對話、紀錄一個觀察... Cmd/Ctrl + Enter 送出"
          disabled={busy}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submit(); }
          }}
          className="w-full resize-vertical rounded-md border border-ink/10 bg-cream/40 px-3 py-2 text-sm leading-6 text-ink placeholder:text-ink/40 focus:border-ink/30 focus:outline-none"
        />
        <div className="flex items-center justify-between">
          <span className="font-v4-mono text-[10.5px] text-ink/45">{isFixtures ? 'fixtures 模式:寫入會被擋下' : '送出立即顯示;DB 寫入背景同步,失敗自動回滾'}</span>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !text.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-paper transition hover:bg-graphite disabled:cursor-not-allowed disabled:bg-ink/25"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : <Send className="h-3.5 w-3.5" strokeWidth={2} />}
            {busy ? '送出中…' : '送出'}
          </button>
        </div>
        {err && <div className="rounded-md border border-claret/30 bg-claret/5 px-3 py-2 text-xs text-claret">{err}</div>}
      </div>

      {localComments.length > 0 ? (
        <div className="grid gap-2">
          {localComments.map((c) => {
            const author = profiles.find((p) => p.id === c.author_id);
            const pending = c.id.startsWith('tmp-');
            return (
              <div
                key={c.id}
                className={cn(
                  'rounded-md border px-4 py-3 transition',
                  c.is_system ? 'border-ink/10 bg-ink/2 text-ink/65'
                    : c.is_raw ? 'border-cobalt/25 bg-cobalt/4'
                      : 'border-ink/10 bg-cream/40',
                  pending && 'opacity-70',
                )}
              >
                <div className="flex items-center justify-between gap-2 font-v4-mono text-[11px] text-ink/45">
                  <span>{author?.full_name ?? (c.is_system ? 'system' : 'ai')}</span>
                  <span className="numeric">{pending ? '同步中…' : `${daysSince(c.created_at)} 天前`}</span>
                </div>
                <div className="mt-1 text-sm leading-6 text-ink/85 whitespace-pre-wrap">{c.body}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-ink/15 bg-paper/60 px-4 py-6 text-center text-xs text-ink/45">
          還沒有活動紀錄。寫第一則上去 ↑
        </div>
      )}
    </section>
  );
}
