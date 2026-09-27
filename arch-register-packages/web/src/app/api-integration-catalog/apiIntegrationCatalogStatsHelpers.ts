import type { RelationRecord } from '@arch-register/api-types/relationContract';
import { RESTRICTED_CLASSIFICATIONS } from './dataFlowRelationDisplay';

export type AtRiskIntegration = {
  relation: RelationRecord;
  crossesBoundary: boolean;
  restricted: boolean;
};

const isCrossingBoundary = (relation: RelationRecord): boolean =>
  relation.cross_boundary === 'cross-boundary';

const isRestrictedClassification = (relation: RelationRecord): boolean =>
  (RESTRICTED_CLASSIFICATIONS as readonly string[]).includes(
    relation.data_classification as string
  );

/**
 * Splits a workspace's Data Flow relations into the crossing-boundary and restricted-classification
 * sets the Overview stat tiles and "Integrations needing attention" panel both need — pulled out of
 * `ApiIntegrationCatalogOverviewScreen.tsx`'s former inline filters so both call sites share one
 * definition of "crossing"/"restricted" rather than risking drift.
 */
export const classifyDataFlowRelations = (
  relations: readonly RelationRecord[]
): { crossing: RelationRecord[]; restricted: RelationRecord[]; highlySensitiveCount: number } => ({
  crossing: relations.filter(isCrossingBoundary),
  restricted: relations.filter(isRestrictedClassification),
  highlySensitiveCount: relations.filter(relation => relation.data_classification === 'highly-sensitive')
    .length
});

/**
 * Relations that either cross a boundary or carry restricted data, deduped (a relation matching
 * both predicates appears once, annotated with both flags) and capped at `limit`, preserving
 * relative order — the "Integrations needing attention" panel's row data.
 */
export const selectAtRiskIntegrations = (
  relations: readonly RelationRecord[],
  limit: number
): AtRiskIntegration[] => {
  const { crossing, restricted } = classifyDataFlowRelations(relations);
  const crossingIds = new Set(crossing.map(relation => relation._uid));
  const restrictedIds = new Set(restricted.map(relation => relation._uid));

  const byId = new Map<string, RelationRecord>();
  for (const relation of [...crossing, ...restricted]) byId.set(relation._uid, relation);

  return [...byId.values()].slice(0, limit).map(relation => ({
    relation,
    crossesBoundary: crossingIds.has(relation._uid),
    restricted: restrictedIds.has(relation._uid)
  }));
};
