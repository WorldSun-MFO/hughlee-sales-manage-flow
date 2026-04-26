export interface MindmapNode {
  id: string;
  owner_id: string;
  parent_id: string | null;
  content: string;
  tags: string[];
  is_inbox: boolean;
  voice_url: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

/** 樹狀節點(server 端組裝完傳給 client)。 */
export interface MindmapTreeNode extends MindmapNode {
  children: MindmapTreeNode[];
}

/** 把扁平節點列表組成樹。 */
export function buildTree(nodes: MindmapNode[], rootParentId: string | null = null): MindmapTreeNode[] {
  const byParent = new Map<string | null, MindmapNode[]>();
  for (const n of nodes) {
    const arr = byParent.get(n.parent_id) ?? [];
    arr.push(n);
    byParent.set(n.parent_id, arr);
  }
  function walk(parentId: string | null): MindmapTreeNode[] {
    const list = byParent.get(parentId) ?? [];
    return list
      .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
      .map(n => ({ ...n, children: walk(n.id) }));
  }
  return walk(rootParentId);
}
