import Link from 'next/link';
import { ChevronRight, Inbox as InboxIcon } from 'lucide-react';
import type { MindmapTreeNode } from '@/lib/mindmap/types';

interface Props {
  node: MindmapTreeNode;
  depth?: number;
}

/** 樹狀節點顯示。預設展開兩層,深度更深的用點點點省略。 */
export function NodeListItem({ node, depth = 0 }: Props) {
  const hasChildren = node.children.length > 0;
  const preview = node.content.split('\n')[0]?.slice(0, 80) || '(空白節點)';

  return (
    <li>
      <Link
        href={`/mindmap/n/${node.id}`}
        className="flex items-center gap-2 py-3 px-2 -mx-2 rounded-xl active:bg-zinc-100 dark:active:bg-zinc-800 transition-colors"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <ChevronRight className="h-4 w-4 text-zinc-400 shrink-0" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600 shrink-0" />
        )}
        {node.is_inbox && <InboxIcon className="h-4 w-4 text-amber-500 shrink-0" />}
        <span className="truncate text-zinc-900 dark:text-zinc-100">{preview}</span>
        {hasChildren && (
          <span className="ml-auto text-xs text-zinc-400 tabular-nums shrink-0">{node.children.length}</span>
        )}
      </Link>

      {/* 自動展開到 depth 1(根節點直接子層),更深的需要點進去看 */}
      {hasChildren && depth < 1 && (
        <ul>
          {node.children.map((child) => (
            <NodeListItem key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
