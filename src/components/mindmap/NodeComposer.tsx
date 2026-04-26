'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { VoiceRecorder } from './VoiceRecorder';

interface Props {
  /** 預設要送到 inbox 嗎?(Inbox 頁的 composer = true) */
  defaultInbox?: boolean;
  /** 建立子節點時用,指定 parent_id */
  parentId?: string | null;
}

export function NodeComposer({ defaultInbox = false, parentId = null }: Props) {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [toInbox, setToInbox] = useState(defaultInbox);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const text = content.trim();
    if (!text) return;
    setError(null);
    try {
      const res = await fetch('/api/mindmap/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text,
          parent_id: parentId,
          is_inbox: toInbox,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '建立失敗');
      setContent('');
      startTransition(() => router.refresh());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '建立失敗');
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 shadow-sm">
      <Textarea
        placeholder={toInbox ? '隨手記下突發奇想…' : '寫下這個節點的內容…'}
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />

      <VoiceRecorder onTranscribed={(t) => setContent((prev) => (prev ? prev + '\n' : '') + t)} />

      <div className="flex items-center gap-2">
        {!parentId && (
          <button
            type="button"
            onClick={() => setToInbox(!toInbox)}
            className={
              'inline-flex items-center gap-1.5 rounded-full px-3 h-9 text-sm transition-colors ' +
              (toInbox
                ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200'
                : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400')
            }
          >
            <Inbox className="h-4 w-4" />
            {toInbox ? '送到 Inbox' : '直接歸類'}
          </button>
        )}
        <div className="flex-1" />
        <Button onClick={submit} disabled={!content.trim() || pending} size="md">
          <Send className="h-4 w-4" />
          {pending ? '送出中…' : '送出'}
        </Button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
