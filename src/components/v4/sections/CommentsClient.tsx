'use client';

// ============================================================
// 活動紀錄 — 寫筆記 + 時間軸列表(v4.1 fire-and-forget 版)
// ============================================================
// 之前:送出後 router.refresh() 等 server re-render(685ms,UI 卡頓)
// 現在:送出後直接把新 comment append 到本地 list,瞬間顯示;
//      DB 寫入背景跑,失敗回滾。
// ============================================================
import { useEffect, useState } from 'react';
import { Loader2, Send, Trash2, FileText } from 'lucide-react';
import type { Comment, Profile } from '@/lib/v4/types';
import { cn } from '@/lib/v4/utils';
import { addComment, deleteComment, patchComment } from '@/lib/v4/mutations';
import { createClient } from '@/lib/supabase/client';
import { InlineTextarea } from '@/components/v4/InlineEdit';

// 活動紀錄時間戳:顯示絕對日期時間(YYYY/MM/DD HH:mm)
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

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
  const [expandedId, setExpandedId] = useState<string | null>(null);   // 哪一筆正在展開原話全文

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

  async function remove(id: string) {
    if (isFixtures) { setErr('fixtures 模式無法刪除'); return; }
    if (id.startsWith('tmp-')) return;            // 還沒寫進 DB,直接擋掉
    if (!confirm('刪除這則活動紀錄?\n(刪除會進 audit log,必要時 admin 可還原)')) return;
    const snapshot = localComments;                // 樂觀刪除,失敗整批回滾
    setLocalComments((prev) => prev.filter((c) => c.id !== id));
    setErr(null);
    try {
      await deleteComment(id);
    } catch (e) {
      setLocalComments(snapshot);
      setErr((e as Error).message);
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
                  'group rounded-md border px-4 py-3 transition',
                  c.is_system ? 'border-ink/10 bg-ink/2 text-ink/65'
                    : c.is_raw ? 'border-cobalt/25 bg-cobalt/4'
                      : 'border-ink/10 bg-cream/40',
                  pending && 'opacity-70',
                )}
              >
                <div className="flex items-center justify-between gap-2 font-v4-mono text-[11px] text-ink/45">
                  <span>{author?.full_name ?? (c.is_system ? 'system' : 'ai')}</span>
                  <div className="flex items-center gap-2">
                    <span className="numeric">{pending ? '同步中…' : fmtDateTime(c.created_at)}</span>
                    {!pending && !isFixtures && (
                      <button
                        type="button"
                        onClick={() => remove(c.id)}
                        title="刪除這則紀錄"
                        className="grid h-5 w-5 place-items-center rounded-sm text-ink/30 opacity-0 transition hover:bg-claret/10 hover:text-claret focus:opacity-100 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                    )}
                  </div>
                </div>
                {/* 內文:非系統紀錄可就地編輯;系統 log 與同步中(tmp)維持唯讀 */}
                {c.is_system || pending ? (
                  <div className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink/85">{c.body}</div>
                ) : (
                  <div className="mt-1">
                    <InlineTextarea
                      value={c.body}
                      onSave={async (next) => {
                        const body = next ?? '';
                        await patchComment(c.id, body);
                        setLocalComments((prev) => prev.map((x) => (x.id === c.id ? { ...x, body } : x)));
                      }}
                      isFixtures={isFixtures}
                      placeholder="(空白紀錄)"
                      rows={3}
                      displayClassName="text-sm leading-6 text-ink/85"
                    />
                  </div>
                )}

                {/* 原話:藏在這筆 AI 摘要內。hover 預覽、點擊展開全文 */}
                {c.raw_body && (
                  <>
                    <div className="group/raw relative mt-2 inline-block">
                      <button
                        type="button"
                        onClick={() => setExpandedId((id) => (id === c.id ? null : c.id))}
                        className="inline-flex items-center gap-1 rounded-sm border border-cobalt/25 bg-cobalt/5 px-1.5 py-0.5 font-v4-mono text-[10.5px] text-cobalt transition hover:bg-cobalt/10"
                      >
                        <FileText className="h-3 w-3" strokeWidth={2} />
                        {expandedId === c.id ? '收合原話' : '原話'}
                      </button>
                      {expandedId !== c.id && (
                        <div className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-80 max-w-[80vw] rounded-md border border-ink/15 bg-paper p-3 shadow-panel group-hover/raw:block">
                          <div className="label-caps mb-1 text-ink/45">原話預覽</div>
                          <div className="line-clamp-5 whitespace-pre-wrap text-xs leading-5 text-ink/70">{c.raw_body}</div>
                          <div className="mt-1.5 font-v4-mono text-[10px] text-ink/40">點擊看完整原話</div>
                        </div>
                      )}
                    </div>
                    {expandedId === c.id && (
                      <div className="mt-2 whitespace-pre-wrap rounded-md border border-cobalt/20 bg-cobalt/4 p-3 text-sm leading-6 text-ink/80">
                        {c.raw_body}
                      </div>
                    )}
                  </>
                )}
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
