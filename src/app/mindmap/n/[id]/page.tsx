import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { MobileShell } from '@/components/mindmap/MobileShell';
import { NodeEditor } from '@/components/mindmap/NodeEditor';
import { NodeComposer } from '@/components/mindmap/NodeComposer';
import { NodeListItem } from '@/components/mindmap/NodeListItem';
import { buildTree, type MindmapNode } from '@/lib/mindmap/types';

export const dynamic = 'force-dynamic';

export default async function NodeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 抓本節點
  const { data: node } = await supabase
    .from('mindmap_nodes')
    .select('*')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single();

  if (!node) notFound();

  // 抓所有節點(規模小,Phase 1 不分頁;client 端組樹)
  const { data: allNodes } = await supabase
    .from('mindmap_nodes')
    .select('*')
    .eq('owner_id', user.id);

  const descendants = collectDescendants((allNodes ?? []) as MindmapNode[], id);
  const subtree = buildTree(descendants, id);

  const titlePreview = (node as MindmapNode).content.split('\n')[0]?.slice(0, 30) || '節點';

  return (
    <MobileShell
      title={titlePreview}
      leftSlot={
        <Link href="/mindmap" className="p-2 -ml-2 rounded-lg active:bg-zinc-100 dark:active:bg-zinc-800">
          <ArrowLeft className="h-5 w-5" />
        </Link>
      }
    >
      <div className="flex flex-col gap-6">
        <section>
          <h2 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">內容</h2>
          <NodeEditor node={node as MindmapNode} />
        </section>

        <section>
          <h2 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">新增子節點</h2>
          <NodeComposer parentId={(node as MindmapNode).id} />
        </section>

        {subtree.length > 0 && (
          <section>
            <h2 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
              子節點 ({subtree.length})
            </h2>
            <ul className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2">
              {subtree.map((c) => (
                <NodeListItem key={c.id} node={c} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </MobileShell>
  );
}

/** 從扁平 list 中抓出 rootId 底下的所有子孫(不含 root 自己)。 */
function collectDescendants(all: MindmapNode[], rootId: string): MindmapNode[] {
  const byParent = new Map<string | null, MindmapNode[]>();
  for (const n of all) {
    const arr = byParent.get(n.parent_id) ?? [];
    arr.push(n);
    byParent.set(n.parent_id, arr);
  }
  const result: MindmapNode[] = [];
  const queue: string[] = [rootId];
  while (queue.length) {
    const pid = queue.shift()!;
    const children = byParent.get(pid) ?? [];
    for (const c of children) {
      result.push(c);
      queue.push(c.id);
    }
  }
  return result;
}
