import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MetricConfig, MetricRollupResponse } from '@arch-register/api-types/metricContract';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { metricRollupQuery } from '../../queries/metrics';
import { buildMetric } from './useCapabilityRollup';
import { extractCapabilityOwnFields } from './capabilityOwnFields';

export type CapabilityTableRollup = {
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
  /** Count of `business-capability-supports-entity` relation instances, across the subtree. */
  appsCount: number | null;
};

const EMPTY_ROLLUP: CapabilityTableRollup = {
  avgMaturity: null,
  avgMaturityTarget: null,
  avgGap: null,
  avgRisk: null,
  sumAnnualInvestment: null,
  investmentCurrencyCode: null,
  appsCount: null
};

// Counts `business-capability-supports-entity` relation instances rather than hopping to the
// entities on the other end (which can be of any schema, so there's no single terminal entity
// schema to aggregate over) — `sourceContext: 'relation'` makes the traversal's terminal the
// relation instance itself. `source` is unused by the server for `count` aggregation (the
// aggregation branch never reads it), so its *value* doesn't matter, but its *kind* does:
// `isMetricSourceAvailable` gates the whole traversal on it, and `kind: 'field'` requires the
// named field to actually exist on `sourceSchemaId` — here that's the relation schema, which has
// no fields at all (`fields: []` in `schemaTemplates.ts`), so a field placeholder (unlike the
// `leafCount` one in `useCapabilityRollup.ts`, which points at the *entity* schema and does have a
// `maturity` field) makes the source permanently "unavailable" and the traversal never runs —
// apps always counted as 0. `kind: 'lifecycle'` is the one source kind `isMetricSourceAvailable`
// always treats as available, matching the working pattern in `metricTraversal.test.ts`.
// Unlike the field metrics below, this one carries an explicit `path` that hops from the box
// entity's own typed-relation field, so it's self-inclusive already — no leaf fallback needed.
//
// `businessCapabilitySupportsEntityRelationSchemaId` must be the *real*, per-workspace relation
// schema id (from `resolveStrategyModelConfig`'s `business_capability_supports_entity` binding) -
// not the schema template's `symId` string ('business-capability-supports-entity'). The metrics
// engine looks up the relation schema by this id (`relationSchemaId` in the `path` step, and
// `sourceSchemaId` for the `sourceContext: 'relation'` terminal); a symId string matches nothing,
// so the traversal silently returns zero terminals - apps always counted as 0.
const buildAppsCountMetric = (
  businessCapabilitySchemaId: string | null,
  businessCapabilitySupportsEntityRelationSchemaId: string | null
): MetricConfig | null =>
  businessCapabilitySchemaId && businessCapabilitySupportsEntityRelationSchemaId
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
 * Batched sibling of `useCapabilityRollup.ts`, for the Capabilities table rather than the
 * single-capability drawer: one `metrics.rollup` request per metric, each covering every visible
 * row's capability ids at once via `boxEntityIds`, instead of one request per row. Returns a map
 * keyed by capability id so callers can look up a row's roll-up without re-deriving it.
 *
 * Takes the full `capabilities` records (not just ids) for the same reason
 * `useCapabilityRollup.ts` takes `ownFields`: the metrics engine's subtree walk excludes the box
 * entity itself, so a capability with no children needs its own `maturity`/`gap`/etc. as a
 * fallback rather than rolling up to "no data" (see that hook's docstring for the full
 * explanation). The screen already has these records in full (`view: 'full'`), so reading the
 * fallback off them costs no extra request.
 */
export const useCapabilityRollups = (
  workspaceId: string,
  businessCapabilitySchemaId: string | null,
  businessCapabilitySupportsEntityRelationSchemaId: string | null,
  capabilities: readonly EntityRecord[]
): { byId: Map<string, CapabilityTableRollup>; isLoading: boolean; error: Error | null } => {
  const boxEntityIds = useMemo(() => capabilities.map(c => c._uid), [capabilities]);
  const ownFieldsById = useMemo(
    () => new Map(capabilities.map(c => [c._uid, extractCapabilityOwnFields(c)])),
    [capabilities]
  );
  const enabled = boxEntityIds.length > 0 && !!businessCapabilitySchemaId;

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
  const appsQuery = useQuery(
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
  );

  const isLoading =
    enabled &&
    (maturityQuery.isLoading ||
      maturityTargetQuery.isLoading ||
      gapQuery.isLoading ||
      riskQuery.isLoading ||
      investmentQuery.isLoading ||
      appsQuery.isLoading);
  const firstError =
    maturityQuery.error ??
    maturityTargetQuery.error ??
    gapQuery.error ??
    riskQuery.error ??
    investmentQuery.error ??
    appsQuery.error ??
    null;
  const error =
    firstError instanceof Error ? firstError : firstError ? new Error(String(firstError)) : null;

  const byId = useMemo(() => {
    const map = new Map<string, CapabilityTableRollup>();
    const resultFor = (query: { data?: MetricRollupResponse }, id: string) =>
      query.data?.results.find(r => r.boxEntityId === id);

    for (const id of boxEntityIds) {
      const own = ownFieldsById.get(id) ?? extractCapabilityOwnFields(null);
      // No children => the metric had nothing to walk, regardless of which metric asked.
      const isLeaf = (resultFor(maturityQuery, id)?.sourceCount ?? 0) === 0;
      const valueFor = (query: { data?: MetricRollupResponse }, fallback: number | null) =>
        isLeaf ? fallback : (resultFor(query, id)?.value ?? null);
      const investmentResult = resultFor(investmentQuery, id);

      map.set(id, {
        ...EMPTY_ROLLUP,
        avgMaturity: valueFor(maturityQuery, own.maturity),
        avgMaturityTarget: valueFor(maturityTargetQuery, own.maturityTarget),
        avgGap: valueFor(gapQuery, own.gap),
        avgRisk: valueFor(riskQuery, own.risk),
        sumAnnualInvestment: isLeaf
          ? (own.investment?.amount ?? null)
          : (investmentResult?.value ?? null),
        investmentCurrencyCode: isLeaf
          ? (own.investment?.currency ?? null)
          : (investmentResult?.currencyCode ?? null),
        appsCount: resultFor(appsQuery, id)?.value ?? null
      });
    }
    return map;
  }, [
    boxEntityIds,
    ownFieldsById,
    maturityQuery,
    maturityTargetQuery,
    gapQuery,
    riskQuery,
    investmentQuery,
    appsQuery
  ]);

  return { byId, isLoading, error };
};
