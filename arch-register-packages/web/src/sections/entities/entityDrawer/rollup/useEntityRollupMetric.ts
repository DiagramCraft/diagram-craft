import { useQuery } from '@tanstack/react-query';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { MetricConfig } from '@arch-register/api-types/metricContract';
import type { MetricTraversalStep } from '@arch-register/api-types/metricContract';
import type { EntityDrawerItem } from '@arch-register/api-types/entityDrawerConfiguration';
import { metricRollupQuery } from '../../../../queries/metrics';
import { extractEntityOwnFields } from './entityOwnFields';

export type RollupAggregation = Extract<EntityDrawerItem, { kind: 'rollup' }>['aggregation'];

/** Drawer `rollup` aggregation ids (`avg`/`sum`/`count`) → metric-engine aggregation names. */
export const ROLLUP_METRIC_AGGREGATION: Record<RollupAggregation, MetricConfig['aggregation']> = {
  avg: 'average',
  sum: 'sum',
  count: 'count'
};

export const buildRollupMetric = (
  schemaId: string | null,
  fieldId: string,
  aggregation: MetricConfig['aggregation'],
  sourceSchemaId: string | null = schemaId,
  traversal?: MetricTraversalStep
): MetricConfig | null =>
  sourceSchemaId
    ? {
        sourceSchemaId,
        source: { kind: 'field', fieldId },
        aggregation,
        ...(traversal ? { path: [traversal] } : {})
      }
    : null;

export type EntityRollupMetric = {
  value: number | null;
  currency: string | null;
  isLoading: boolean;
  error: Error | null;
};

const EMPTY: EntityRollupMetric = { value: null, currency: null, isLoading: false, error: null };

/**
 * Roll-up hook over the `#2012` metric engine for one entity + one drawer `rollup` item: a single
 * `metrics.rollup` request scoped to the entity with no traversal `path`, which defaults to
 * walking the full recursive `parent` containment subtree.
 *
 * The metrics engine's subtree walk excludes the box entity itself, so an entity with no children
 * rolls up to "no data" without a fallback; `ownEntity` supplies the entity's own field value,
 * applied whenever the subtree is empty (a leaf).
 */
export const useEntityRollupMetric = (
  workspaceId: string,
  schemaId: string | null,
  entityId: string | null,
  fieldId: string,
  aggregation: RollupAggregation,
  ownEntity?: EntityRecord | null,
  sourceSchemaId?: string,
  traversal?: MetricTraversalStep
): EntityRollupMetric => {
  const boxEntityIds = entityId ? [entityId] : [];
  const enabled = boxEntityIds.length > 0 && !!schemaId;
  const query = useQuery(
    metricRollupQuery(
      workspaceId,
      {
        boxEntityIds,
        metric: buildRollupMetric(
          schemaId,
          fieldId,
          ROLLUP_METRIC_AGGREGATION[aggregation],
          sourceSchemaId ?? schemaId,
          traversal
        )
      },
      enabled
    )
  );

  const id0 = boxEntityIds[0];
  if (!id0) return { ...EMPTY, isLoading: query.isLoading, error: (query.error as Error) ?? null };

  const result = query.data?.results.find(candidate => candidate.boxEntityId === id0);
  const isLegacyContainmentRollup = traversal === undefined;
  const isLeaf = (result?.sourceCount ?? 0) === 0;
  const own = extractEntityOwnFields(ownEntity, [fieldId])[fieldId];
  const value =
    isLegacyContainmentRollup && isLeaf
      ? aggregation === 'count'
        ? 1
        : (own?.value ?? null)
      : (result?.value ?? null);

  return {
    value,
    currency:
      isLegacyContainmentRollup && isLeaf
        ? (own?.currency ?? null)
        : (result?.currencyCode ?? null),
    isLoading: query.isLoading,
    error: (query.error as Error) ?? null
  };
};
