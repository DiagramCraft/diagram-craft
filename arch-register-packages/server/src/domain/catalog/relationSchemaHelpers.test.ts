import { describe, expect, it } from 'vitest';
import { buildCreateRelationSchemaInput } from './relationSchemaHelpers';

const now = new Date('2026-06-01T12:00:00.000Z');
const knownEntitySchemaIds = new Set(['entity-schema-1', 'entity-schema-2']);

const baseBody = {
  name: 'Depends on',
  in: { schemaIds: ['entity-schema-1'] },
  out: { schemaIds: ['entity-schema-2'] }
};

describe('buildCreateRelationSchemaInput — endpoint schemaIds normalization', () => {
  it('keeps an explicit schemaIds list as-is', () => {
    const input = buildCreateRelationSchemaInput(
      'workspace-1',
      baseBody,
      knownEntitySchemaIds,
      now
    );

    expect(input.in_schema_ids).toEqual(['entity-schema-1']);
    expect(input.out_schema_ids).toEqual(['entity-schema-2']);
  });

  it('rejects an explicit schemaIds entry referencing an unknown entity schema', () => {
    expect(() =>
      buildCreateRelationSchemaInput(
        'workspace-1',
        { ...baseBody, in: { schemaIds: ['unknown-schema'] } },
        knownEntitySchemaIds,
        now
      )
    ).toThrow();
  });

  it('accepts the "any" wildcard without validating against known entity schemas', () => {
    const input = buildCreateRelationSchemaInput(
      'workspace-1',
      { ...baseBody, in: { schemaIds: 'any' } },
      knownEntitySchemaIds,
      now
    );

    expect(input.in_schema_ids).toBe('any');
    expect(input.out_schema_ids).toEqual(['entity-schema-2']);
  });

  it('accepts the wildcard on both endpoints', () => {
    const input = buildCreateRelationSchemaInput(
      'workspace-1',
      { ...baseBody, in: { schemaIds: 'any' }, out: { schemaIds: 'any' } },
      knownEntitySchemaIds,
      now
    );

    expect(input.in_schema_ids).toBe('any');
    expect(input.out_schema_ids).toBe('any');
  });
});
