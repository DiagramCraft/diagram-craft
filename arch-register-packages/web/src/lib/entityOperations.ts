import type { EntityFacets } from '@arch-register/api-types/entityContract';
import { apiFetch } from './http';

export const fetchEntityFacets = (workspace: string) =>
  apiFetch<EntityFacets>(`/api/${workspace}/data/facets`);
