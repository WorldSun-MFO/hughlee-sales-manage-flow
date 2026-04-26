'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Trash2, Inbox as InboxIcon, FolderOutput } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { VoiceRecorder } from './VoiceRecorder';
import type { MindmapNode } from '@/lib/mindmap/types';

interface Props {
  node: MindmapNode;
}

export function NodeEditor({ node }: Props) {
  const router = useRouter();
  const [content, setContent] = useState(node.content);
  const [isInbox, setIsInbox] = useState(node.is_inbox);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const dirty = content !== node.content || isInbox !== node.is_inbox;

  async function save() {
    setError(null);
    try {
      const res = await fetch(`/api/mindmap/nodes/${node.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, is_inbox: isInbox }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '儲存失敗');
      startTransition(() => router.refresh());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '儲存失敗');
    }
  }

  async function remove() {
    if (!confirm('確定刪除這個節點?(子節點會一起刪除)')) return;
    setError(null);
    try {
      const res = await fetch(`/api/mindmap/nodes/${node.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '刪除失敗');
      router.push(node.is_inbox ? '/mindmap/inbox' : '/mindmap');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '刪除失敗');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="min-h-[200px]"
        placeholder="這個節點寫什麼…"
      />

      <VoiceRecorder onTranscribed={(t) => setContent((prev) => (prev ? prev + '\n' : '') + t)} />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setIsInbox(!isInbox)}
          className={
            'inline-flex items-center gap-1.5 rounded-full px-3 h-9 text-sm transition-colors ' +
            (isInbox
              ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200'
              : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400')
          }
        >
          {isInbox ? <InboxIcon className="h-4 w-4" /> : <FolderOutput className="h-4 w-4" />}
          {isInbox ? '在 Inbox' : '已歸類'}
        </button>

        <div className="flex-1" />

        <Button variant="ghost" size="md" onClick={remove} className="text-red-600 dark:text-red-400">
          <Trash2 className="h-4 w-4" />
          刪除
        </Button>
        <Button onClick={save} disabled={!dirty || pending} size="md">
          <Save className="h-4 w-4" />
          {pending ? '儲存中…' : '儲存'}
        </Button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
