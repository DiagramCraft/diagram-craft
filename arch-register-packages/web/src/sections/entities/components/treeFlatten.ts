export type TreeItemLike<T> = T & { _uid: string; children: TreeItemLike<T>[] };

type TreeNodeShape = { _uid: string; children: TreeNodeShape[] };

export type FlatTreeRow<I extends TreeNodeShape> = {
  item: I;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
};

/**
 * Flattens a tree into visible rows in tree order. Children of collapsed nodes are skipped;
 * every node is expanded unless its id is in `collapsedIds`.
 */
export const flattenTree = <I extends TreeNodeShape>(
  roots: I[],
  collapsedIds: ReadonlySet<string>
): FlatTreeRow<I>[] => {
  const rows: FlatTreeRow<I>[] = [];
  const visit = (item: I, depth: number) => {
    const hasChildren = item.children.length > 0;
    const expanded = !collapsedIds.has(item._uid);
    rows.push({ item, depth, hasChildren, expanded });
    if (hasChildren && expanded) {
      for (const child of item.children as I[]) visit(child, depth + 1);
    }
  };
  for (const root of roots) visit(root, 0);
  return rows;
};
