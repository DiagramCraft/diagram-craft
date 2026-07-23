import { describe, expect, it } from 'vitest';
import {
  buildEntityQueryForExecution,
  findEntityQueryRequestConflicts,
  parseEntityQuery
} from './entityQuery';

describe('parseEntityQuery', () => {
  it('supplies domain defaults', () => {
    expect(parseEntityQuery({})).toEqual({
      entityQuery: null,
      schemaId: null,
      owner: null,
      lifecycle: null,
      q: '',
      conditions: [],
      assessmentId: null,
      projectId: null,
      projectScope: 'all',
      collectionId: null,
      view: 'full',
      limit: null,
      offset: 0,
      asOf: null,
      includeProjectSnapshots: true
    });
  });

  it('normalizes conditions and dates', () => {
    const result = parseEntityQuery({
      conditions: [{ fieldId: 'name', op: 'equals', value: 'API' }],
      asOf: '2026-07-05T12:00:00Z',
      includeProjectSnapshots: false
    });

    expect(result.conditions).toHaveLength(1);
    expect(result.asOf?.toISOString()).toBe('2026-07-05T12:00:00.000Z');
    expect(result.includeProjectSnapshots).toBe(false);
  });

  it('parses a collection filter', () => {
    expect(parseEntityQuery({ collectionId: 'collection-1' }).collectionId).toBe('collection-1');
  });

  it('treats absent filters and malformed dates as absent', () => {
    expect(parseEntityQuery({ asOf: 'invalid' })).toMatchObject({
      conditions: [],
      asOf: null
    });
  });

  it('maps legacy flat conditions to structured execution when SQL-compatible', () => {
    const parsed = parseEntityQuery({
      _schemaId: 'schema-component',
      conditions: [{ fieldId: '_name', op: 'contains', value: 'API' }]
    });

    expect(buildEntityQueryForExecution({ conditions: parsed.conditions }, parsed)).toEqual({
      schemaId: 'schema-component',
      root: {
        kind: 'and',
        children: [{ kind: 'predicate', path: [], fieldId: '_name', op: 'contains', value: 'API' }]
      },
      projectScope: 'all'
    });
  });

  it('keeps completeness and assessment conditions on the legacy fallback path', () => {
    const parsed = parseEntityQuery({
      conditions: [{ fieldId: '_completeness', op: 'lt', value: 50 }]
    });
    expect(buildEntityQueryForExecution({ conditions: parsed.conditions }, parsed)).toBeNull();
  });
});

describe('findEntityQueryRequestConflicts', () => {
  const entityQuery = {
    schemaId: 'schema-1',
    projectId: 'project-1',
    root: { kind: 'and' as const, children: [] }
  };

  it('allows matching duplicate scope fields and non-overlapping legacy filters', () => {
    expect(
      findEntityQueryRequestConflicts({
        entityQuery,
        _schemaId: 'schema-1',
        projectId: 'project-1',
        owner: 'team-1',
        q: 'search'
      })
    ).toEqual([]);
  });

  it('reports conflicting duplicate fields and legacy conditions', () => {
    expect(
      findEntityQueryRequestConflicts({
        entityQuery,
        _schemaId: 'schema-2',
        projectId: 'project-2',
        conditions: []
      })
    ).toEqual(['conditions', '_schemaId', 'projectId']);
  });
});
