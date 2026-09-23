import type { MetricConfig } from '@arch-register/api-types/metricContract';

/** The shared Vendor Management metric used by portfolio spend views. */
export const buildVendorSpendMetric = (contractSchemaId: string | null): MetricConfig | null =>
  contractSchemaId
    ? {
        sourceSchemaId: contractSchemaId,
        source: { kind: 'field', fieldId: 'annual_cost' },
        aggregation: 'sum',
        traversalPath: [{ kind: 'backward', fieldId: 'vendor', ownerSchemaId: contractSchemaId }]
      }
    : null;
