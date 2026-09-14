import type { MetricConfig, MetricRollupResponse } from '@arch-register/api-types/metricContract';
import { metricRollupQuery } from '../../queries/metrics';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

/** A vendor's spend roll-up: total annual spend across its own Contracts, plus how many
 *  contracts contributed. */
export type VendorSpendRollup = {
  vmSpend: number | null;
  currency: string | null;
  contractCount: number | null;
  isLoading: boolean;
  error: Error | null;
};

const EMPTY: VendorSpendRollup = {
  vmSpend: null,
  currency: null,
  contractCount: null,
  isLoading: false,
  error: null
};

/**
 * `Contract.annual_cost` summed over one Vendor's own Contracts — exported for
 * `useVendorSpendRollups.ts` (the batched, table-wide sibling of this hook).
 *
 * Uses an explicit single-hop backward containment step (Contract's own `vendor` containment
 * field) rather than relying on the metric engine's implicit wildcard-subtree default when
 * `traversalPath` is omitted — self-documenting, and matches the generic "backward containment
 * hop" pattern `mapMetricConfig.ts` already offers for any containment parent/child schema pair.
 */
export const buildVendorSpendMetric = (contractSchemaId: string | null): MetricConfig | null =>
  contractSchemaId
    ? {
        sourceSchemaId: contractSchemaId,
        source: { kind: 'field', fieldId: 'annual_cost' },
        aggregation: 'sum',
        traversalPath: [{ kind: 'backward', fieldId: 'vendor', ownerSchemaId: contractSchemaId }]
      }
    : null;

/**
 * Roll-up hook over the `#2012` metric engine for a single vendor (the drawer): one
 * `metrics.rollup` request summing `annual_cost` across the vendor's own Contracts.
 *
 * Unlike `useCapabilityRollup.ts`, there's no own-value fallback for a vendor with no contracts
 * — Vendor has no direct spend field of its own, so `sourceCount === 0` legitimately means
 * `vmSpend` is `null` (nothing to report), not "missing data".
 */
export const useVendorSpendRollup = (
  workspaceId: string,
  contractSchemaId: string | null,
  vendorId: string | null
): VendorSpendRollup => {
  const boxEntityIds = useMemo(() => (vendorId ? [vendorId] : []), [vendorId]);
  const enabled = boxEntityIds.length > 0 && !!contractSchemaId;

  const query = useQuery(
    metricRollupQuery(
      workspaceId,
      { boxEntityIds, metric: buildVendorSpendMetric(contractSchemaId) },
      enabled
    )
  );

  if (!enabled) return EMPTY;

  const id0 = boxEntityIds[0];
  const result = (query.data as MetricRollupResponse | undefined)?.results.find(
    r => r.boxEntityId === id0
  );

  const error =
    query.error instanceof Error
      ? query.error
      : query.error
        ? new Error(String(query.error))
        : null;

  return {
    vmSpend: result?.value ?? null,
    currency: result?.currencyCode ?? null,
    contractCount: result?.sourceCount ?? null,
    isLoading: query.isLoading,
    error
  };
};
