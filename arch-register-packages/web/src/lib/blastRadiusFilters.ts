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
