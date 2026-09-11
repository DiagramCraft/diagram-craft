import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import type { MetricConfig, MetricRollupResponse } from '@arch-register/api-types/metricContract';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { DerivedRollup } from '@arch-register/api-types/app/strategy-model/strategyModelViewConfig';
import { metricRollupQuery } from '../../queries/metrics';
import { buildMetric, METRIC_AGGREGATION } from './useCapabilityRollup';
import { extractCapabilityOwnFields } from './capabilityOwnFields';

/** A table-row roll-up: subtree aggregates keyed by roll-up field id, plus the apps count. */
export type CapabilityTableRollup = {
  values: Record<string, number | null>;
  currency: Record<string, string | null>;
  /** Count of `business-capability-supports-entity` relation instances across the subtree. */
  appsCount: number | null;
};

const EMPTY_ROLLUP: CapabilityTableRollup = { values: {}, currency: {}, appsCount: null };

// Counts `business-capability-supports-entity` relation instances rather than hopping to the
// entities on the other end (which can be of any schema). See the long note kept in git history;
// `kind: 'lifecycle'` is the one source kind `isMetricSourceAvailable` always treats as available.
// `businessCapabilitySupportsEntityRelationSchemaId` must be the real, per-workspace relation
// schema id (from `resolveStrategyModelConfig`'s `business_capability_supports_entity` binding).
const buildAppsCountMetric = (
  businessCapabilitySchemaId: string | null,
  businessCapabilitySupportsEntityRelationSchemaId: string | null
): MetricConfig | null =>
  businessCapabilitySupportsEntityRelationSchemaId && businessCapabilitySchemaId
    ? {
        sourceSchemaId: businessCapabilitySupportsEntityRelationSchemaId,
        sourceContext: 'relation',
        traversalPath: [
          {
            kind: 'containmentSubtree',
            fieldId: 'parent',
            ownerSchemaId: businessCapabilitySchemaId
          },
          {
            kind: 'typedRelation',
            fieldId: 'supported_entities',
            relationSchemaId: businessCapabilitySupportsEntityRelationSchemaId,
            direction: 'in',
            ownerSchemaIds: [businessCapabilitySchemaId]
          }
        ],
        traversalPathMode: 'exact',
        source: { kind: 'lifecycle' },
        aggregation: 'count'
      }
    : null;

/**
 * Batched sibling of `useCapabilityRollup.ts`, for the Capabilities table / capability map rather
 * than the single-capability drawer: one `metrics.rollup` request per configured roll-up, each
 * covering every visible row's capability ids at once via `boxEntityIds`. Returns a map keyed by
 * capability id.
 *
 * `capabilities` are passed in full (not just ids) so a childless capability can fall back to its
 * own field values (the metrics engine's subtree walk excludes the box entity itself).
 */
export const useCapabilityRollups = (
  workspaceId: string,
  businessCapabilitySchemaId: string | null,
  businessCapabilitySupportsEntityRelationSchemaId: string | null,
  capabilities: readonly EntityRecord[],
  rollups: readonly DerivedRollup[]
): { byId: Map<string, CapabilityTableRollup>; isLoading: boolean; error: Error | null } => {
  const boxEntityIds = useMemo(() => capabilities.map(c => c._uid), [capabilities]);
  const fieldIds = useMemo(() => rollups.map(rollup => rollup.fieldId), [rollups]);
  const ownFieldsById = useMemo(
    () => new Map(capabilities.map(c => [c._uid, extractCapabilityOwnFields(c, fieldIds)])),
    [capabilities, fieldIds]
  );
  const enabled = boxEntityIds.length > 0 && !!businessCapabilitySchemaId;

  const queries = useQueries({
    queries: [
      ...rollups.map(rollup =>
        metricRollupQuery(
          workspaceId,
          {
            boxEntityIds,
            metric: buildMetric(
              businessCapabilitySchemaId,
              rollup.fieldId,
              METRIC_AGGREGATION[rollup.aggregation]
            )
          },
          enabled
        )
      ),
      metricRollupQuery(
        workspaceId,
        {
          boxEntityIds,
          metric: buildAppsCountMetric(
            businessCapabilitySchemaId,
            businessCapabilitySupportsEntityRelationSchemaId
          )
        },
        enabled
      )
    ]
  });

  const rollupQueries = queries.slice(0, rollups.length);
  const appsQuery = queries[rollups.length];

  const isLoading = enabled && queries.some(query => query.isLoading);
  const firstError = queries.map(query => query.error).find(Boolean) ?? null;
  const error =
    firstError instanceof Error ? firstError : firstError ? new Error(String(firstError)) : null;

  const byId = useMemo(() => {
    const map = new Map<string, CapabilityTableRollup>();
    const resultFor = (query: { data?: MetricRollupResponse } | undefined, id: string) =>
      query?.data?.results.find(result => result.boxEntityId === id);

    for (const id of boxEntityIds) {
      const own = ownFieldsById.get(id) ?? {};
      const isLeaf = (resultFor(rollupQueries[0], id)?.sourceCount ?? 0) === 0;
      const values: Record<string, number | null> = {};
      const currency: Record<string, string | null> = {};
      rollups.forEach((rollup, index) => {
        const result = resultFor(rollupQueries[index], id);
        values[rollup.fieldId] = isLeaf
          ? (own[rollup.fieldId]?.value ?? null)
          : (result?.value ?? null);
        currency[rollup.fieldId] = isLeaf
          ? (own[rollup.fieldId]?.currency ?? null)
          : (result?.currencyCode ?? null);
      });
      map.set(id, {
        ...EMPTY_ROLLUP,
        values,
        currency,
        appsCount: resultFor(appsQuery, id)?.value ?? null
      });
    }
    return map;
  }, [boxEntityIds, ownFieldsById, rollups, rollupQueries, appsQuery]);

  return { byId, isLoading, error };
};
