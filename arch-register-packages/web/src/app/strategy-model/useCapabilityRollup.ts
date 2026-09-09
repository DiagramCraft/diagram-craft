import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import type { MetricConfig, MetricRollupResponse } from '@arch-register/api-types/metricContract';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { RollupField } from '@arch-register/api-types/app/strategy-model/strategyModelViewConfig';
import { metricRollupQuery } from '../../queries/metrics';
import { extractCapabilityOwnFields } from './capabilityOwnFields';

/**
 * A capability roll-up, keyed by the `business_capability` field id of each configured roll-up
 * (`StrategyModelViewConfig.rollups`). Values are the subtree aggregate (or the capability's own
 * value when it has no children); `currency` carries the currency code for currency-typed fields.
 */
export type CapabilityRollup = {
  values: Record<string, number | null>;
  currency: Record<string, string | null>;
  /** Count of descendant capabilities with no containment children of their own. */
  leafCount: number | null;
  /** Total descendant capabilities in the subtree (same for every roll-up metric). */
  sourceCount: number;
  isLoading: boolean;
  error: Error | null;
};

/** Roll-up aggregation ids (`avg`/`sum`) → metric-engine aggregation names. */
export const METRIC_AGGREGATION: Record<RollupField['aggregation'], MetricConfig['aggregation']> = {
  avg: 'average',
  sum: 'sum'
};

// Exported for `useCapabilityRollups.ts` (the batched, table-wide sibling of this hook).
export const buildMetric = (
  businessCapabilitySchemaId: string | null,
  fieldId: string,
  aggregation: MetricConfig['aggregation']
): MetricConfig | null =>
  businessCapabilitySchemaId
    ? {
        sourceSchemaId: businessCapabilitySchemaId,
        source: { kind: 'field', fieldId },
        aggregation
      }
    : null;

const EMPTY: CapabilityRollup = {
  values: {},
  currency: {},
  leafCount: null,
  sourceCount: 0,
  isLoading: false,
  error: null
};

/**
 * Roll-up hook over the `#2012` metric engine for a single capability (the drawer). Fires one
 * `metrics.rollup` request per configured roll-up — each scoped to the capability with no
 * traversal `path`, which defaults to walking the full recursive `parent` containment subtree —
 * plus one `leafCount` request, and combines the results.
 *
 * The metrics engine's subtree walk excludes the box entity itself, so a capability with no
 * children rolls up to "no data" without a fallback; `ownEntity` supplies the capability's own
 * field values, applied whenever `sourceCount` is 0.
 */
export const useCapabilityRollup = (
  workspaceId: string,
  businessCapabilitySchemaId: string | null,
  capabilityId: string | null,
  rollups: readonly RollupField[],
  ownEntity?: EntityRecord | null
): CapabilityRollup => {
  const boxEntityIds = useMemo(() => (capabilityId ? [capabilityId] : []), [capabilityId]);
  const enabled = boxEntityIds.length > 0 && !!businessCapabilitySchemaId;
  const fieldIds = useMemo(() => rollups.map(rollup => rollup.fieldId), [rollups]);
  const own = useMemo(
    () => extractCapabilityOwnFields(ownEntity ?? null, fieldIds),
    [ownEntity, fieldIds]
  );

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
      // `leafCount` requires a `source` it doesn't read — reuse the first roll-up field as a placeholder.
      metricRollupQuery(
        workspaceId,
        {
          boxEntityIds,
          metric: buildMetric(businessCapabilitySchemaId, fieldIds[0] ?? 'maturity', 'leafCount')
        },
        enabled && rollups.length > 0
      )
    ]
  });

  const rollupQueries = queries.slice(0, rollups.length);
  const leafQuery = queries[rollups.length];

  const isLoading = enabled && queries.some(query => query.isLoading);
  const firstError = queries.map(query => query.error).find(Boolean) ?? null;
  const error =
    firstError instanceof Error ? firstError : firstError ? new Error(String(firstError)) : null;

  const id0 = boxEntityIds[0];
  if (!id0) return { ...EMPTY, isLoading, error };

  const resultFor = (query: { data?: MetricRollupResponse } | undefined) =>
    query?.data?.results.find(result => result.boxEntityId === id0);
  const isLeaf = (resultFor(rollupQueries[0])?.sourceCount ?? 0) === 0;

  const values: Record<string, number | null> = {};
  const currency: Record<string, string | null> = {};
  rollups.forEach((rollup, index) => {
    const result = resultFor(rollupQueries[index]);
    values[rollup.fieldId] = isLeaf ? (own[rollup.fieldId]?.value ?? null) : (result?.value ?? null);
    currency[rollup.fieldId] = isLeaf
      ? (own[rollup.fieldId]?.currency ?? null)
      : (result?.currencyCode ?? null);
  });

  return {
    values,
    currency,
    leafCount: isLeaf ? 1 : (resultFor(leafQuery)?.value ?? null),
    sourceCount: resultFor(rollupQueries[0])?.sourceCount ?? 0,
    isLoading,
    error
  };
};
