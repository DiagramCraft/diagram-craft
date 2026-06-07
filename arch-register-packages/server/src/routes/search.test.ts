import { describe, expect, it } from 'vitest';
import {
  collectFieldMatches,
  collectMatchedFields,
  collectMatchedMetadata,
  includesQuery,
  parseTypes
} from './search';
import type { Entity, SchemaField } from '../types';

const now = new Date('2026-06-01T12:00:00.000Z');

const entity: Entity = {
  id: 'entity-1',
  workspace: 'default',
  slug: 'frontend-app',
  namespace: 'default',
  name: 'Frontend App',
  description: 'React single-page application',
  owner: 'Design Systems',
  lifecycle: 'production',
  tags: ['react', 'frontend'],
  links: [{ title: 'Docs', url: 'https://example.com/react', type: 'docs' }],
  schema_id: 'schema-component',
  data: {
    technology: 'React',
    runtime: 'Node',
    notes: 'Uses GraphQL gateway'
  },
  visibility_mode: null,
  created_at: now,
  updated_at: now
};

const fields: SchemaField[] = [
  { id: 'technology', name: 'Technology', type: 'text' },
  {
    id: 'depends_on',
    name: 'Depends On',
    type: 'reference',
    schemaId: 'schema-component',
    minCount: 0,
    maxCount: -1
  },
  { id: 'service_tier', name: 'Service Tier', type: 'text' }
];

describe('search route helpers', () => {
  it('parses all search types when omitted', () => {
    expect(parseTypes(undefined)).toEqual(['projects', 'files', 'entities', 'schemas']);
    expect(parseTypes('')).toEqual(['projects', 'files', 'entities', 'schemas']);
  });

  it('parses, trims, and deduplicates requested types', () => {
    expect(parseTypes(' files,entities ,files,schemas ')).toEqual(['files', 'entities', 'schemas']);
  });

  it('rejects invalid search types', () => {
    expect(() => parseTypes('files,unknown')).toThrowError(
      'types must be a comma-separated list of: projects, files, entities, schemas'
    );
  });

  it('matches query text case-insensitively', () => {
    expect(includesQuery('Frontend App', 'frontend')).toBe(true);
    expect(includesQuery('Frontend App', 'BACKEND')).toBe(false);
    expect(includesQuery(null, 'frontend')).toBe(false);
  });

  it('collects matching entity metadata fields', () => {
    expect(collectMatchedMetadata(entity, 'react')).toEqual(['description', 'tags', 'links']);
    expect(collectMatchedMetadata(entity, 'design')).toEqual(['owner']);
  });

  it('collects matching entity data fields', () => {
    expect(collectMatchedFields(entity.data, 'node')).toEqual(['runtime']);
    expect(collectMatchedFields(entity.data, 'graphql')).toEqual(['notes']);
  });

  it('collects matching schema fields by id and display name', () => {
    expect(collectFieldMatches(fields, 'technology')).toEqual([
      { fieldId: 'technology', fieldName: 'Technology' }
    ]);
    expect(collectFieldMatches(fields, 'depends')).toEqual([
      { fieldId: 'depends_on', fieldName: 'Depends On' }
    ]);
    expect(collectFieldMatches(fields, 'tier')).toEqual([
      { fieldId: 'service_tier', fieldName: 'Service Tier' }
    ]);
  });
});
