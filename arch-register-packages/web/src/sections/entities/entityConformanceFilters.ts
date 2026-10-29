import type {
  ConformanceCheckStatus,
  ConformanceSeverity
} from '@arch-register/api-types/conformanceContract';

export type EntityConformanceFilters = {
  status: '' | ConformanceCheckStatus;
  severity: '' | ConformanceSeverity;
  checkId: string;
  schemaId: string;
};

export const DEFAULT_ENTITY_CONFORMANCE_FILTERS: EntityConformanceFilters = {
  status: 'active',
  severity: '',
  checkId: '',
  schemaId: ''
};

export const toViolationQuery = (
  filters: EntityConformanceFilters,
  page: { limit: number; offset: number }
) => ({
  status: filters.status || undefined,
  severity: filters.severity || undefined,
  checkId: filters.checkId || undefined,
  schemaId: filters.schemaId || undefined,
  limit: page.limit,
  offset: page.offset
});
