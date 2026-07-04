import type {
  EntityFacets,
  EntityLink,
  EntityRecord
} from '@arch-register/api-types/entityContract';
import { apiFetch } from './http';

export const createEntity = (
  workspace: string,
  entity: {
    _schemaId: string;
    _name: string;
    _slug?: string;
    _namespace?: string;
    _description?: string;
    _owner?: string | null;
    _lifecycle?: string | null;
    _tags?: string[];
    _links?: EntityLink[];
    _visibilityMode?: 'public' | 'restricted';
    [key: string]: unknown;
  }
) =>
  apiFetch<EntityRecord>(`/api/${workspace}/data`, {
    method: 'POST',
    body: JSON.stringify(entity)
  });

export const fetchEntityFacets = (workspace: string) =>
  apiFetch<EntityFacets>(`/api/${workspace}/data/facets`);
