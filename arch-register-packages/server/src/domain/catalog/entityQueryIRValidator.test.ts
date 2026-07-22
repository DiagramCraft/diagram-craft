import { describe, expect, it } from 'vitest';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import { validateEntityQueryIR, type SchemaCatalog } from './entityQueryIRValidator';
import type { SchemaDbResult } from './db/catalogDatabase';

const now = new Date('2026-06-29T12:00:00.000Z');

const makeSchema = (id: string, fields: SchemaDbResult['fields'] = []): SchemaDbResult => ({
  id,
  workspace: 'ws-1',
  name: id,
  description: '',
  fields,
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: id.slice(0, 3).toUpperCase(),
  created_at: now,
  updated_at: now
});

const DOMAIN = makeSchema('domain-schema');
const SYSTEM = makeSchema('system-schema', [
  {
    id: 'domain',
    name: 'Domain',
    type: 'containment',
    schemaId: DOMAIN.id,
    minCount: 0,
    maxCount: 1
  }
]);
const COMPONENT = makeSchema('component-schema', [
  {
    id: 'eol_date',
    name: 'EOL Date',
    type: 'date'
  }
]);

const schemas: SchemaCatalog = new Map([
  [DOMAIN.id, DOMAIN],
  [SYSTEM.id, SYSTEM],
  [COMPONENT.id, COMPONENT]
]);

describe('validateEntityQueryIR', () => {
  it('accepts a path at exactly MAX_PATH_HOPS', () => {
    const query: EntityQuery = {
      root: {
        kind: 'relationExists',
        path: Array.from({ length: 6 }, () => ({
          kind: 'backward' as const,
          fieldId: 'domain',
          ownerSchemaId: SYSTEM.id
        }))
      }
    };
    expect(validateEntityQueryIR(query, schemas)).toEqual({ ok: true });
  });

  it('rejects a path exceeding MAX_PATH_HOPS', () => {
    const query: EntityQuery = {
      root: {
        kind: 'relationExists',
        path: Array.from({ length: 7 }, () => ({
          kind: 'backward' as const,
          fieldId: 'domain',
          ownerSchemaId: SYSTEM.id
        }))
      }
    };
    const result = validateEntityQueryIR(query, schemas);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.message.includes('MAX_PATH_HOPS'))).toBe(true);
    }
  });

  it('counts hops nested inside a PathStep.filter cumulatively', () => {
    const query: EntityQuery = {
      root: {
        kind: 'relationExists',
        path: [
          {
            kind: 'backward',
            fieldId: 'domain',
            ownerSchemaId: SYSTEM.id,
            filter: {
              kind: 'relationExists',
              path: Array.from({ length: 6 }, () => ({
                kind: 'backward' as const,
                fieldId: 'domain',
                ownerSchemaId: SYSTEM.id
              }))
            }
          }
        ]
      }
    };
    const result = validateEntityQueryIR(query, schemas);
    expect(result.ok).toBe(false);
  });

  it('accepts a backward step whose ownerSchemaId genuinely owns the field', () => {
    const query: EntityQuery = {
      schemaId: DOMAIN.id,
      root: {
        kind: 'relationExists',
        path: [{ kind: 'backward', fieldId: 'domain', ownerSchemaId: SYSTEM.id }]
      }
    };
    expect(validateEntityQueryIR(query, schemas)).toEqual({ ok: true });
  });

  it('rejects a backward step whose ownerSchemaId does not define the field', () => {
    const query: EntityQuery = {
      root: {
        kind: 'relationExists',
        path: [{ kind: 'backward', fieldId: 'domain', ownerSchemaId: COMPONENT.id }]
      }
    };
    const result = validateEntityQueryIR(query, schemas);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.path.includes('fieldId'))).toBe(true);
    }
  });

  it('rejects a backward step naming an unknown ownerSchemaId', () => {
    const query: EntityQuery = {
      root: {
        kind: 'relationExists',
        path: [{ kind: 'backward', fieldId: 'domain', ownerSchemaId: 'does-not-exist' }]
      }
    };
    const result = validateEntityQueryIR(query, schemas);
    expect(result.ok).toBe(false);
  });

  it('accepts an empty and/or children array as vacuously true/false', () => {
    const query: EntityQuery = { root: { kind: 'and', children: [] } };
    expect(validateEntityQueryIR(query, schemas)).toEqual({ ok: true });
  });

  it('rejects an unknown fieldId on a forward step', () => {
    const query: EntityQuery = {
      root: {
        kind: 'predicate',
        path: [{ kind: 'forward', fieldId: 'not_a_real_field' }],
        fieldId: '_name',
        op: 'equals',
        value: 'x'
      }
    };
    const result = validateEntityQueryIR(query, schemas);
    expect(result.ok).toBe(false);
  });

  it('accepts underscore pseudo-fields without checking them against schema fields', () => {
    const query: EntityQuery = {
      root: {
        kind: 'predicate',
        path: [],
        fieldId: '_slug',
        op: 'equals',
        value: 'go'
      }
    };
    expect(validateEntityQueryIR(query, schemas)).toEqual({ ok: true });
  });

  it('rejects an _assessment predicate when assessmentId is not set', () => {
    const query: EntityQuery = {
      root: {
        kind: 'predicate',
        path: [],
        fieldId: '_assessment:riskLevel',
        op: 'gte',
        value: 3
      }
    };
    const result = validateEntityQueryIR(query, schemas);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.path[0] === 'assessmentId')).toBe(true);
    }
  });

  it('accepts an _assessment predicate when assessmentId is set', () => {
    const query: EntityQuery = {
      assessmentId: 'assessment-1',
      root: {
        kind: 'predicate',
        path: [],
        fieldId: '_assessment:riskLevel',
        op: 'gte',
        value: 3
      }
    };
    expect(validateEntityQueryIR(query, schemas)).toEqual({ ok: true });
  });

  it('finds an _assessment predicate nested inside a PathStep.filter', () => {
    const query: EntityQuery = {
      root: {
        kind: 'relationExists',
        path: [
          {
            kind: 'backward',
            fieldId: 'domain',
            ownerSchemaId: SYSTEM.id,
            filter: {
              kind: 'predicate',
              path: [],
              fieldId: '_assessment',
              op: 'not_empty',
              value: null
            }
          }
        ]
      }
    };
    const result = validateEntityQueryIR(query, schemas);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.path[0] === 'assessmentId')).toBe(true);
    }
  });
});
