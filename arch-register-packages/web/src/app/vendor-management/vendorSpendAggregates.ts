import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { VendorSpendRollupValue } from './useVendorSpendRollups';

/**
 * `vmTotalSpend` — portfolio-wide total across a batched `useVendorSpendRollups` result. There's
 * no server-side "grand total" roll-up (a single `metrics.rollup` result is scoped to its
 * `boxEntityIds`); summing the already-fetched per-vendor values client-side avoids a second
 * request.
 */
export const computeVmTotalSpend = (byId: ReadonlyMap<string, VendorSpendRollupValue>): number =>
  [...byId.values()].reduce((total, { vmSpend }) => total + (vmSpend ?? 0), 0);

/**
 * `vmGroupSpend` — spend summed per distinct value of a Vendor field (e.g. `cost_centre` or
 * `tier`). The metric engine has no server-side "group by field value" aggregation
 * (`metricRollupRequestSchema` only aggregates per `boxEntityIds`, and the query-DSL's aggregate
 * expressions only support `count`/`countDistinct` reducers), so this groups the already-fetched
 * batched spend by reading each vendor's own field value client-side.
 *
 * Vendors with no value for `groupByFieldId` are grouped under `'—'`.
 */
export const computeVmGroupSpend = (
  vendors: readonly EntityRecord[],
  byId: ReadonlyMap<string, VendorSpendRollupValue>,
  groupByFieldId: string
): Map<string, number> => {
  const groups = new Map<string, number>();
  for (const vendor of vendors) {
    const rawValue = vendor[groupByFieldId];
    const groupValue = typeof rawValue === 'string' && rawValue.length > 0 ? rawValue : '—';
    const vmSpend = byId.get(vendor._uid)?.vmSpend ?? 0;
    groups.set(groupValue, (groups.get(groupValue) ?? 0) + vmSpend);
  }
  return groups;
};
