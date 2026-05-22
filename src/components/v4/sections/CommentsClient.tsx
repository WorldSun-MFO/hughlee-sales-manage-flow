'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Send } from 'lucide-react';
import type { Comment, Profile } from '@/lib/v4/types';
import { cn, daysSince } from '@/lib/v4/utils';
import { addComment } from '@/lib/v4/mutations';

export function CommentsClient({
  dealId, comments, profiles, isFixtures,
}: {
  dealId: string;
  comments: Comment[];
  profiles: Profile[];
  isFixtures: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    const body = text.trim();
    if (!body || busy) return;
    if (isFixtures) { setErr('fixtures 模式無法寫入'); return; }
    setBusy(true); setErr(null);
    try {
      await addComment(dealId, body);
      setText('');
      startTransition(() => router.refresh());
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <section className="grid gap-3">
      <div className="label-caps text-ink/55">活動紀錄 · {comments.length}</div>

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
          <span className="font-v4-mono text-[10.5px] text-ink/45">{isFixtures ? 'fixtures 模式:寫入會被擋下' : '會以你的身分寫入,RM/隊員都看得到'}</span>
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

      {comments.length > 0 ? (
        <div className="grid gap-2">
          {comments.map((c) => {
            const author = profiles.find((p) => p.id === c.author_id);
            return (
              <div
                key={c.id}
                className={cn(
                  'rounded-md border px-4 py-3',
                  c.is_system ? 'border-ink/10 bg-ink/2 text-ink/65'
                    : c.is_raw ? 'border-cobalt/25 bg-cobalt/4'
                      : 'border-ink/10 bg-cream/40',
                )}
              >
                <div className="flex items-center justify-between gap-2 font-v4-mono text-[11px] text-ink/45">
                  <span>{author?.full_name ?? (c.is_system ? 'system' : 'ai')}</span>
                  <span className="numeric">{daysSince(c.created_at)} 天前</span>
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
