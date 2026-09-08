import type { TreeNode, TreeEdge } from '@arch-register/api-types/entityContract';

export type CapabilityTreeItem = TreeNode & { children: CapabilityTreeItem[] };

/**
 * Builds a parent/child capability tree from `entities.tree`'s flat `nodes`/`edges` response,
 * with siblings sorted alphabetically at every level. Shared by `StrategySidebar`'s capability
 * tree and `StrategyCapabilitiesScreen`'s hierarchical name-sort order (see
 * `flattenCapabilityTree` below) so both read the same shape the same way.
 */
export const buildCapabilityTree = (
  nodes: readonly TreeNode[],
  edges: readonly TreeEdge[]
): CapabilityTreeItem[] => {
  const nodeMap = new Map<string, CapabilityTreeItem>();
  for (const node of nodes) nodeMap.set(node._uid, { ...node, children: [] });

  const childIds = new Set<string>();
  for (const { parentId, childId } of edges) {
    const parent = nodeMap.get(parentId);
    const child = nodeMap.get(childId);
    if (parent && child) {
      parent.children.push(child);
      childIds.add(childId);
    }
  }
  for (const item of nodeMap.values()) {
    item.children.sort((a, b) => a._name.localeCompare(b._name));
  }
  return [...nodeMap.values()]
    .filter(item => !childIds.has(item._uid))
    .sort((a, b) => a._name.localeCompare(b._name));
};

/**
 * Flattens a capability tree into pre-order (parent immediately followed by its children,
 * siblings alphabetical) — the "level-aware name sort" order `StrategyCapabilitiesScreen` sorts
 * by when its own sort key is 'name', so the table's tree-style indent lines up with row order
 * instead of a plain alphabetical sort scattering siblings.
 */
export const flattenCapabilityTree = (tree: readonly CapabilityTreeItem[]): string[] => {
  const ids: string[] = [];
  const visit = (items: readonly CapabilityTreeItem[]) => {
    for (const item of items) {
      ids.push(item._uid);
      visit(item.children);
    }
  };
  visit(tree);
  return ids;
};
