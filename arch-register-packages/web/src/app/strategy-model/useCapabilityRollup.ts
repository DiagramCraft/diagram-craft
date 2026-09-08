import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MetricConfig, MetricRollupResponse } from '@arch-register/api-types/metricContract';
import { metricRollupQuery } from '../../queries/metrics';
import { extractCapabilityOwnFields, type CapabilityOwnFields } from './capabilityOwnFields';

export type CapabilityRollup = {
  /** Average `maturity` across the capability's full recursive containment subtree. */
  avgMaturity: number | null;
  /** Average `maturity_target` across the subtree. */
  avgMaturityTarget: number | null;
  /** Average `gap` (`maturity_target - maturity`) across the subtree. */
  avgGap: number | null;
  /** Average `risk` across the subtree. */
  avgRisk: number | null;
  /** Summed `annual_investment` across the subtree. */
  sumAnnualInvestment: number | null;
  /** Currency code of `sumAnnualInvestment`, when all populated values share one currency. */
  investmentCurrencyCode: string | null;
  /** Count of descendant capabilities with no containment children of their own. */
  leafCount: number | null;
  /** Total descendant capabilities in the subtree (same for every metric above). */
  sourceCount: number;
  isLoading: boolean;
  error: Error | null;
};

// Exported for `useCapabilityRollups.ts` (the batched, table-wide sibling of this hook), which
// builds the same field-sourced metrics over many `boxEntityIds` in one request per metric instead
// of per capability.
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

/**
 * Thin roll-up hook over the `#2012` metric engine: rather than one `MetricConfig` (which
 * aggregates a single value), a capability roll-up needs several averages/sums/counts at once, so
 * this fires one `metrics.rollup` request per metric — each scoped to the single capability with
 * no traversal `path`, which defaults to walking the full recursive `parent` containment subtree —
 * and combines the results into one object.
 *
 * The metrics engine's subtree walk deliberately excludes the box entity itself
 * (`collectDescendantIds`'s "the box entity itself is excluded" — correct where a box groups
 * differently-schemaed descendants, e.g. a map cell). A Business Capability with no children has
 * no descendants at all, so without a fallback its own directly-set `maturity`/`gap`/etc. would
 * roll up to "no data" instead of themselves. `ownFields` (the capability's own field values, from
 * `extractCapabilityOwnFields` over the entity `CapabilityDrawer` already fetches) is that
 * fallback, applied whenever a metric's `sourceCount` comes back 0 (no children).
 */
export const useCapabilityRollup = (
  workspaceId: string,
  businessCapabilitySchemaId: string | null,
  capabilityId: string | null,
  ownFields?: CapabilityOwnFields
): CapabilityRollup => {
  const boxEntityIds = useMemo(() => (capabilityId ? [capabilityId] : []), [capabilityId]);
  const enabled = boxEntityIds.length > 0;
  const own = ownFields ?? extractCapabilityOwnFields(null);

  const maturityQuery = useQuery(
    metricRollupQuery(
      workspaceId,
      { boxEntityIds, metric: buildMetric(businessCapabilitySchemaId, 'maturity', 'average') },
      enabled
    )
  );
  const maturityTargetQuery = useQuery(
    metricRollupQuery(
      workspaceId,
      {
        boxEntityIds,
        metric: buildMetric(businessCapabilitySchemaId, 'maturity_target', 'average')
      },
      enabled
    )
  );
  const gapQuery = useQuery(
    metricRollupQuery(
      workspaceId,
      { boxEntityIds, metric: buildMetric(businessCapabilitySchemaId, 'gap', 'average') },
      enabled
    )
  );
  const riskQuery = useQuery(
    metricRollupQuery(
      workspaceId,
      { boxEntityIds, metric: buildMetric(businessCapabilitySchemaId, 'risk', 'average') },
      enabled
    )
  );
  const investmentQuery = useQuery(
    metricRollupQuery(
      workspaceId,
      { boxEntityIds, metric: buildMetric(businessCapabilitySchemaId, 'annual_investment', 'sum') },
      enabled
    )
  );
  // `leafCount` requires a `source`, but doesn't use it — reuse the `maturity` field as a
  // placeholder, matching the existing `'count'` aggregation convention.
  const leavesQuery = useQuery(
    metricRollupQuery(
      workspaceId,
      { boxEntityIds, metric: buildMetric(businessCapabilitySchemaId, 'maturity', 'leafCount') },
      enabled
    )
  );

  const capabilityId0 = boxEntityIds[0];
  const isLoading =
    enabled &&
    (maturityQuery.isLoading ||
      maturityTargetQuery.isLoading ||
      gapQuery.isLoading ||
      riskQuery.isLoading ||
      investmentQuery.isLoading ||
      leavesQuery.isLoading);
  const firstError =
    maturityQuery.error ??
    maturityTargetQuery.error ??
    gapQuery.error ??
    riskQuery.error ??
    investmentQuery.error ??
    leavesQuery.error ??
    null;
  const error =
    firstError instanceof Error ? firstError : firstError ? new Error(String(firstError)) : null;

  const resultFor = (query: { data?: MetricRollupResponse }) =>
    query.data?.results.find(r => r.boxEntityId === capabilityId0);
  // No children => the metric had nothing to walk, regardless of which metric asked.
  const isLeaf = (resultFor(maturityQuery)?.sourceCount ?? 0) === 0;
  const valueFor = (query: { data?: MetricRollupResponse }, fallback: number | null) =>
    isLeaf ? fallback : (resultFor(query)?.value ?? null);

  if (!capabilityId0) {
    return {
      avgMaturity: null,
      avgMaturityTarget: null,
      avgGap: null,
      avgRisk: null,
      sumAnnualInvestment: null,
      investmentCurrencyCode: null,
      leafCount: null,
      sourceCount: 0,
      isLoading,
      error
    };
  }

  const investmentResult = resultFor(investmentQuery);

  return {
    avgMaturity: valueFor(maturityQuery, own.maturity),
    avgMaturityTarget: valueFor(maturityTargetQuery, own.maturityTarget),
    avgGap: valueFor(gapQuery, own.gap),
    avgRisk: valueFor(riskQuery, own.risk),
    sumAnnualInvestment: isLeaf ? (own.investment?.amount ?? null) : (investmentResult?.value ?? null),
    investmentCurrencyCode: isLeaf
      ? (own.investment?.currency ?? null)
      : (investmentResult?.currencyCode ?? null),
    leafCount: isLeaf ? 1 : (resultFor(leavesQuery)?.value ?? null),
    sourceCount: resultFor(maturityQuery)?.sourceCount ?? 0,
    isLoading,
    error
  };
};
