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
  businessCapabilitySupportsEntityRelationSchemaId: string | null
): MetricConfig | null =>
  businessCapabilitySupportsEntityRelationSchemaId
    ? {
        sourceSchemaId: businessCapabilitySupportsEntityRelationSchemaId,
        sourceContext: 'relation',
        path: [
          {
            kind: 'typedRelation',
            fieldId: 'supported_entities',
            relationSchemaId: businessCapabilitySupportsEntityRelationSchemaId,
            direction: 'in'
          }
        ],
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
 * own field values (the metrics engine's subtree walk excludes the box entity itself). `treeEdges`
 * is needed for `appsCount` only — the apps-count metric is path-based and returns a capability's
 * own directly-linked applications, so it is rolled up here by summing across the subtree.
 */
export const useCapabilityRollups = (
  workspaceId: string,
  businessCapabilitySchemaId: string | null,
  businessCapabilitySupportsEntityRelationSchemaId: string | null,
  capabilities: readonly EntityRecord[],
  rollups: readonly DerivedRollup[],
  treeEdges: readonly { parentId: string; childId: string }[] = []
): { byId: Map<string, CapabilityTableRollup>; isLoading: boolean; error: Error | null } => {
  const boxEntityIds = useMemo(() => capabilities.map(c => c._uid), [capabilities]);
  const fieldIds = useMemo(() => rollups.map(rollup => rollup.fieldId), [rollups]);
  const ownFieldsById = useMemo(
    () => new Map(capabilities.map(c => [c._uid, extractCapabilityOwnFields(c, fieldIds)])),
    [capabilities, fieldIds]
  );
  const childrenOf = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const { parentId, childId } of treeEdges) {
      map.set(parentId, [...(map.get(parentId) ?? []), childId]);
    }
    return map;
  }, [treeEdges]);
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
        { boxEntityIds, metric: buildAppsCountMetric(businessCapabilitySupportsEntityRelationSchemaId) },
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

    const rawApps = new Map<string, number | null>(
      boxEntityIds.map(id => [id, resultFor(appsQuery, id)?.value ?? null])
    );
    const subtreeApps = (id: string, seen = new Set<string>()): number | null => {
      if (seen.has(id)) return null;
      seen.add(id);
      let total: number | null = rawApps.get(id) ?? null;
      for (const childId of childrenOf.get(id) ?? []) {
        const childTotal = subtreeApps(childId, seen);
        if (childTotal != null) total = (total ?? 0) + childTotal;
      }
      return total;
    };

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
      map.set(id, { ...EMPTY_ROLLUP, values, currency, appsCount: subtreeApps(id) });
    }
    return map;
  }, [boxEntityIds, ownFieldsById, childrenOf, rollups, rollupQueries, appsQuery]);

  return { byId, isLoading, error };
};
