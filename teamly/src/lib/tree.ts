// Assemble a flat list of pages into a nested tree. Pure + testable.

export interface FlatPage {
  id: string;
  parentId: string | null;
  title: string;
  slug: string;
  position: number;
}

export interface PageTreeNode extends FlatPage {
  children: PageTreeNode[];
}

export function buildPageTree(pages: FlatPage[]): PageTreeNode[] {
  const byId = new Map<string, PageTreeNode>();
  for (const p of pages) byId.set(p.id, { ...p, children: [] });

  const roots: PageTreeNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sort = (nodes: PageTreeNode[]): PageTreeNode[] => {
    nodes.sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
    for (const n of nodes) sort(n.children);
    return nodes;
  };
  return sort(roots);
}

// Flatten a subtree to ids (used for cascade checks / breadcrumbs).
export function descendantIds(node: PageTreeNode): string[] {
  const out: string[] = [];
  const stack = [...node.children];
  while (stack.length) {
    const n = stack.pop()!;
    out.push(n.id);
    stack.push(...n.children);
  }
  return out;
}
