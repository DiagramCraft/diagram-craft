import type { EntityFacets } from '@arch-register/api-types/entityContract';
import { apiFetch } from './http';
import { applicationCatalogPath } from './applicationApi';

export const fetchEntityFacets = (workspace: string) =>
  apiFetch<EntityFacets>(applicationCatalogPath(workspace, '/data/facets'));
