import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MetricRollupResponse } from '@arch-register/api-types/metricContract';
import { metricRollupQuery } from '../../queries/metrics';
import { buildVendorSpendMetric } from './vendorSpendMetric';

/** One vendor's spend, keyed by vendor `_uid` — the batched, table-wide sibling of
 *  the shared single-vendor spend metric's result shape. */
export type VendorSpendRollupValue = {
  vmSpend: number | null;
  currency: string | null;
  contractCount: number | null;
};

export type VendorSpendRollups = {
  byId: Map<string, VendorSpendRollupValue>;
  isLoading: boolean;
  error: Error | null;
};

const EMPTY: VendorSpendRollups = { byId: new Map(), isLoading: false, error: null };

/**
 * Batched spend hook for table/overview screens: one `metrics.rollup`
 * request across every visible vendor's id at once, returning a map keyed by vendor `_uid`.
 */
export const useVendorSpendRollups = (
  workspaceId: string,
  contractSchemaId: string | null,
  vendorIds: readonly string[]
): VendorSpendRollups => {
  const boxEntityIds = useMemo(() => [...vendorIds], [vendorIds]);
  const enabled = boxEntityIds.length > 0 && !!contractSchemaId;

  const query = useQuery(
    metricRollupQuery(
      workspaceId,
      { boxEntityIds, metric: buildVendorSpendMetric(contractSchemaId) },
      enabled
    )
  );

  const byId = useMemo(() => {
    const map = new Map<string, VendorSpendRollupValue>();
    const data = query.data as MetricRollupResponse | undefined;
    for (const id of boxEntityIds) {
      const result = data?.results.find(r => r.boxEntityId === id);
      map.set(id, {
        vmSpend: result?.value ?? null,
        currency: result?.currencyCode ?? null,
        contractCount: result?.sourceCount ?? null
      });
    }
    return map;
  }, [boxEntityIds, query.data]);

  if (!enabled) return EMPTY;

  const error =
    query.error instanceof Error
      ? query.error
      : query.error
        ? new Error(String(query.error))
        : null;

  return { byId, isLoading: query.isLoading, error };
};
