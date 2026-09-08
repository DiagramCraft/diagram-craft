import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MetricConfig } from '@arch-register/api-types/metricContract';
import { metricRollupQuery } from '../../queries/metrics';

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

const buildMetric = (
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
 * and combines the results into one object. `gap` is read directly from the capability schema's
 * derived `gap` field rather than recomputed here. "Unioned supporting entities" is intentionally
 * not part of this roll-up (see `CapabilityDrawer`'s "Realized by" section and its follow-up
 * issue) — this hook aggregates numeric fields only.
 */
export const useCapabilityRollup = (
  workspaceId: string,
  businessCapabilitySchemaId: string | null,
  capabilityId: string | null
): CapabilityRollup => {
  const boxEntityIds = useMemo(() => (capabilityId ? [capabilityId] : []), [capabilityId]);
  const enabled = boxEntityIds.length > 0;

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

  const valueFor = (query: {
    data?: { results: { boxEntityId: string; value: number | null }[] };
  }) => query.data?.results.find(r => r.boxEntityId === capabilityId0)?.value ?? null;

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

  const investmentResult = investmentQuery.data?.results.find(r => r.boxEntityId === capabilityId0);

  return {
    avgMaturity: valueFor(maturityQuery),
    avgMaturityTarget: valueFor(maturityTargetQuery),
    avgGap: valueFor(gapQuery),
    avgRisk: valueFor(riskQuery),
    sumAnnualInvestment: investmentResult?.value ?? null,
    investmentCurrencyCode: investmentResult?.currencyCode ?? null,
    leafCount: valueFor(leavesQuery),
    sourceCount:
      maturityQuery.data?.results.find(r => r.boxEntityId === capabilityId0)?.sourceCount ?? 0,
    isLoading,
    error
  };
};
