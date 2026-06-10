import { H3, defineHandler, getQuery } from 'h3';
import type { DatabaseAdapter } from '../../db/database';
import type { EntityDbResult } from '../catalog/db/catalogDatabase';
import { parsePositiveInt } from '../../utils/http';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { httpAssert } from '../../utils/httpAssert';
import { searchWorkspace } from './searchOperations';
import { SchemaField } from '@arch-register/api-types/schemaContract';

const BASE = '/api/:workspace/search';

export const SEARCH_TYPES = ['projects', 'files', 'entities', 'schemas'] as const;

export type SearchType = (typeof SEARCH_TYPES)[number];

export const parseTypes = (value: unknown): SearchType[] => {
  if (value == null || value === '') return [...SEARCH_TYPES];
  const parsed = String(value)
    .split(',')
    .map(type => type.trim())
    .filter((type): type is SearchType => type.length > 0);

  const invalid = parsed.filter(type => !SEARCH_TYPES.includes(type as SearchType));
  httpAssert.true(invalid.length === 0, {
    message: `types must be a comma-separated list of: ${SEARCH_TYPES.join(', ')}`
  });

  return [...new Set(parsed as SearchType[])];
};

export const includesQuery = (value: unknown, query: string) =>
  String(value ?? '')
    .toLowerCase()
    .includes(query);

export const collectMatchedMetadata = (entity: EntityDbResult, query: string) => {
  const matches: string[] = [];
  if (includesQuery(entity.name, query)) matches.push('name');
  if (includesQuery(entity.slug, query)) matches.push('slug');
  if (includesQuery(entity.description, query)) matches.push('description');
  if (includesQuery(entity.namespace, query)) matches.push('namespace');
  if (includesQuery(entity.owner_name, query)) matches.push('owner');
  if (includesQuery(entity.lifecycle_label, query)) matches.push('lifecycle');
  if (entity.tags.some(tag => includesQuery(tag, query))) matches.push('tags');
  if (
    entity.links.some(
      link =>
        includesQuery(link.title, query) ||
        includesQuery(link.url, query) ||
        includesQuery(link.type, query)
    )
  ) {
    matches.push('links');
  }
  return matches;
};

export const collectMatchedFields = (data: EntityDbResult['data'], query: string) =>
  Object.entries(data)
    .filter(([, value]) => includesQuery(value, query))
    .map(([key]) => key);

export const collectFieldMatches = (
  fields: SchemaField[],
  query: string
): Array<{ fieldId: string; fieldName: string }> =>
  fields
    .filter(field => includesQuery(field.id, query) || includesQuery(field.name, query))
    .map(field => ({
      fieldId: field.id,
      fieldName: field.name
    }));

export function createSearchRoutes(db: DatabaseAdapter) {
  const router = new H3();

  router.get(
    BASE,
    defineHandler(async event => {
      const workspace = event.context.params?.['workspace'] ?? '';
      const query = getQuery(event);
      const q = typeof query['q'] === 'string' ? query['q'] : undefined;
      const limitPerType = parsePositiveInt(query['limitPerType'], 'limitPerType') ?? undefined;
      const types = typeof query['types'] === 'string' ? query['types'] : undefined;
      return await searchWorkspace(
        db,
        workspace,
        { q, limitPerType, types },
        event as AuthenticatedEvent
      );
    })
  );

  return router;
}
