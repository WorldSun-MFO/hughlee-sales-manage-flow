'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search as SearchIcon } from 'lucide-react';
import { MobileShell } from '@/components/mindmap/MobileShell';
import { Input } from '@/components/ui/Input';
import { createClient } from '@/lib/supabase/client';
import type { MindmapNode } from '@/lib/mindmap/types';

export default function SearchPage() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<MindmapNode[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (!term) { setResults([]); return; }
    const handle = setTimeout(async () => {
      setLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from('mindmap_nodes')
        .select('*')
        .eq('owner_id', user.id)
        .ilike('content', `%${term}%`)
        .order('updated_at', { ascending: false })
        .limit(50);
      setResults((data ?? []) as MindmapNode[]);
      setLoading(false);
    }, 250);
    return () => clearTimeout(handle);
  }, [q]);

  return (
    <MobileShell title="搜尋" active="search">
      <div className="flex flex-col gap-4">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 pointer-events-none" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜尋節點內容…"
            className="pl-10"
          />
        </div>

        {loading && <p className="text-sm text-zinc-500">搜尋中…</p>}

        {!loading && q.trim() && results.length === 0 && (
          <p className="text-sm text-zinc-500">沒找到包含「{q.trim()}」的節點。</p>
        )}

        {results.length > 0 && (
          <ul className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
            {results.map((n) => (
              <li key={n.id}>
                <Link href={`/mindmap/n/${n.id}`} className="block p-3 active:bg-zinc-50 dark:active:bg-zinc-800/50">
                  <Highlight text={n.content.slice(0, 200)} term={q.trim()} />
                  <p className="text-xs text-zinc-400 mt-1">
                    {new Date(n.updated_at).toLocaleDateString('zh-Hant')}
                    {n.is_inbox && <span className="ml-2 text-amber-500">· Inbox</span>}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </MobileShell>
  );
}

function Highlight({ text, term }: { text: string; term: string }) {
  if (!term) return <span>{text}</span>;
  const lower = text.toLowerCase();
  const t = term.toLowerCase();
  const parts: { s: string; hit: boolean }[] = [];
  let i = 0;
  while (i < text.length) {
    const idx = lower.indexOf(t, i);
    if (idx < 0) { parts.push({ s: text.slice(i), hit: false }); break; }
    if (idx > i) parts.push({ s: text.slice(i, idx), hit: false });
    parts.push({ s: text.slice(idx, idx + term.length), hit: true });
    i = idx + term.length;
  }
  return (
    <p className="text-zinc-900 dark:text-zinc-100 line-clamp-3">
      {parts.map((p, i) => p.hit
        ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-500/30 text-inherit rounded px-0.5">{p.s}</mark>
        : <span key={i}>{p.s}</span>
      )}
    </p>
  );
}
