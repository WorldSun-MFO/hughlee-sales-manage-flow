import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Inbox as InboxIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { MobileShell } from '@/components/mindmap/MobileShell';
import { NodeComposer } from '@/components/mindmap/NodeComposer';

export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: nodes } = await supabase
    .from('mindmap_nodes')
    .select('*')
    .eq('owner_id', user.id)
    .eq('is_inbox', true)
    .order('created_at', { ascending: false });

  return (
    <MobileShell title="Inbox · 突發奇想" active="inbox">
      <div className="flex flex-col gap-4">
        <NodeComposer defaultInbox />

        {(!nodes || nodes.length === 0) ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            收件匣空了,讚 ✨ 想到什麼隨手丟進來,週末再整理。
          </div>
        ) : (
          <ul className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
            {nodes.map((n) => {
              const preview = n.content.split('\n')[0]?.slice(0, 100) || '(空白節點)';
              const date = new Date(n.created_at).toLocaleDateString('zh-Hant', { month: 'short', day: 'numeric' });
              return (
                <li key={n.id}>
                  <Link href={`/mindmap/n/${n.id}`} className="flex items-start gap-3 p-3 active:bg-zinc-50 dark:active:bg-zinc-800/50 transition-colors">
                    <InboxIcon className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-zinc-900 dark:text-zinc-100 line-clamp-2">{preview}</p>
                      <p className="text-xs text-zinc-400 mt-1">{date}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </MobileShell>
  );
}
