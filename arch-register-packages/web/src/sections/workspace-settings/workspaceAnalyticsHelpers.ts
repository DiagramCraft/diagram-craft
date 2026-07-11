import type { FilterCondition } from '@arch-register/api-types/viewContract';

const encodeFilters = (filters: FilterCondition[]) =>
  filters.length > 0 ? JSON.stringify(filters) : undefined;

export const analyticsEntitySearch = (
  overrides: {
    type?: string;
    status?: string;
    filters?: FilterCondition[];
  } = {}
) => ({
  type: overrides.type,
  status: overrides.status,
  filters: encodeFilters(overrides.filters ?? [])
});

export const lifecycleSearch = (lifecycleId: string | null) =>
  lifecycleId == null
    ? analyticsEntitySearch({
        filters: [{ fieldId: '_lifecycle', op: 'empty', value: '' }]
      })
    : analyticsEntitySearch({ status: lifecycleId });

export const schemaLifecycleSearch = (schemaId: string, lifecycleId: string | null) =>
  lifecycleId == null
    ? analyticsEntitySearch({
        type: schemaId,
        filters: [{ fieldId: '_lifecycle', op: 'empty', value: '' }]
      })
    : analyticsEntitySearch({ type: schemaId, status: lifecycleId });

export const ownershipGapSearch = (schemaId: string) =>
  analyticsEntitySearch({
    type: schemaId,
    filters: [{ fieldId: '_owner', op: 'empty', value: '' }]
  });

export const completenessSearch = (schemaId: string, bucket: 'below50' | 'between50And79') =>
  analyticsEntitySearch({
    type: schemaId,
    filters:
      bucket === 'below50'
        ? [{ fieldId: '_completeness', op: 'lt', value: 50 }]
        : [
            { fieldId: '_completeness', op: 'gt', value: 49 },
            { fieldId: '_completeness', op: 'lt', value: 80 }
          ]
  });

export const staleSearch = (cutoffAt: string, schemaId?: string) =>
  analyticsEntitySearch({
    type: schemaId,
    filters: [{ fieldId: '_updatedAt', op: 'before', value: cutoffAt }]
  });
