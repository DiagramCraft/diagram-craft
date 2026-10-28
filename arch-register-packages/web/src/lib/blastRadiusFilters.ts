import type { EntityTraversalAggregation } from '@arch-register/api-types/entityTraversalContract';

export type BlastRadiusEntity = EntityTraversalAggregation['entities'][number];

// The traversal engine has no per-hop "which field/relation schema was used" metadata (see
// entityTraversal.ts's `relationSubtree` step) - filtering by relationship type is approximated
// by the set of entity schemas encountered along the path (excluding the root and the result
// itself), not the raw field/relation-schema identity.
export type BlastRadiusEntityFilters = {
  ownerId: string | null;
  schemaIds: string[] | null;
  viaSchemaIds: string[] | null;
};

/** The intermediate hops between the traversal root and this entity, excluding both endpoints. */
export const viaSchemaIdsForEntity = (entity: BlastRadiusEntity): string[] =>
  entity.paths.flatMap(path => path.provenance.slice(1, -1).map(hop => hop.schemaId));

export const filterBlastRadiusEntities = (
  entities: readonly BlastRadiusEntity[],
  filters: BlastRadiusEntityFilters
): BlastRadiusEntity[] =>
  entities.filter(entity => {
    if (filters.ownerId && entity.ownerId !== filters.ownerId) return false;
    if (filters.schemaIds && !filters.schemaIds.includes(entity.schemaId)) return false;
    if (filters.viaSchemaIds) {
      const viaSchemaIds = new Set(viaSchemaIdsForEntity(entity));
      if (!filters.viaSchemaIds.some(schemaId => viaSchemaIds.has(schemaId))) return false;
    }
    return true;
  });

export const uniqueProvenanceHopIds = (entities: readonly BlastRadiusEntity[]): string[] => [
  ...new Set(
    entities.flatMap(entity => entity.paths.flatMap(path => path.provenance.map(hop => hop.id)))
  )
];

export type BlastRadiusTreeNode = { entity: BlastRadiusEntity; children: BlastRadiusTreeNode[] };

/**
 * Arranges blast-radius results as a tree under the traversal root, using each entity's first
 * path: its parent is the nearest earlier entity on that path that is itself in the results (so
 * an owner filter that drops an intermediate entity attaches its descendants one level up). The
 * root (depth 0) is not part of the tree. Siblings are sorted by name.
 */
export const buildBlastRadiusTree = (
  entities: readonly BlastRadiusEntity[]
): BlastRadiusTreeNode[] => {
  const nodes = new Map<string, BlastRadiusTreeNode>(
    entities
      .filter(entity => entity.depth >= 1)
      .map(entity => [entity.entityId, { entity, children: [] }])
  );
  const roots: BlastRadiusTreeNode[] = [];

  for (const node of nodes.values()) {
    const provenance = node.entity.paths[0]?.provenance ?? [];
    let parent: BlastRadiusTreeNode | undefined;
    // Index 0 is the traversal root and the last hop is the entity itself.
    for (let index = provenance.length - 2; index >= 1 && !parent; index--) {
      const hop = provenance[index]!;
      if (hop.context === 'entity') parent = nodes.get(hop.id);
    }
    (parent ? parent.children : roots).push(node);
  }

  const sortByName = (list: BlastRadiusTreeNode[]) => {
    list.sort((a, b) => a.entity.entityName.localeCompare(b.entity.entityName));
    list.forEach(node => sortByName(node.children));
  };
  sortByName(roots);
  return roots;
};
