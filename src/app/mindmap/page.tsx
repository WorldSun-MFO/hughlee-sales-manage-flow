import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { buildTree } from '@/lib/mindmap/types';
import { MobileShell } from '@/components/mindmap/MobileShell';
import { NodeComposer } from '@/components/mindmap/NodeComposer';
import { NodeListItem } from '@/components/mindmap/NodeListItem';

export const dynamic = 'force-dynamic';

export default async function MindmapHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 抓出所有「非 inbox」節點(inbox 在另一頁)
  const { data: nodes, error } = await supabase
    .from('mindmap_nodes')
    .select('*')
    .eq('owner_id', user.id)
    .eq('is_inbox', false)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  const tree = nodes ? buildTree(nodes) : [];

  return (
    <MobileShell title="我的腦圖" active="home">
      <div className="flex flex-col gap-4">
        <NodeComposer />

        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">
            載入失敗:{error.message}
          </div>
        )}

        {tree.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            還沒有節點。在上方 composer 寫第一條,或去 Inbox 把突發奇想整理進來。
          </div>
        ) : (
          <ul className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2">
            {tree.map((n) => (
              <NodeListItem key={n.id} node={n} />
            ))}
          </ul>
        )}
      </div>
    </MobileShell>
  );
}
