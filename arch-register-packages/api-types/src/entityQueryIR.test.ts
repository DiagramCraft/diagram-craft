import { describe, expect, it } from 'vitest';
import { pathStepSchema, queryNodeSchema, type PathStep } from './entityQueryIR';

describe('relationForward PathStep', () => {
  it('parses a bare relationForward step', () => {
    const step: PathStep = { kind: 'relationForward', fieldId: 'data' };
    expect(pathStepSchema.safeParse(step).success).toBe(true);
  });

  it('parses a relationForward step with a nested filter', () => {
    const step: PathStep = {
      kind: 'relationForward',
      fieldId: 'data',
      filter: { kind: 'predicate', path: [], fieldId: '_name', op: 'equals', value: 'Address' }
    };
    expect(pathStepSchema.safeParse(step).success).toBe(true);
  });

  it('rejects a relationForward step missing fieldId', () => {
    const result = pathStepSchema.safeParse({ kind: 'relationForward' });
    expect(result.success).toBe(false);
  });
});

describe('relationBackward PathStep', () => {
  it('parses a bare relationBackward step', () => {
    const step: PathStep = {
      kind: 'relationBackward',
      fieldId: 'data',
      relationSchemaId: 'relation-schema-1'
    };
    expect(pathStepSchema.safeParse(step).success).toBe(true);
  });

  it('parses a relationBackward step with a nested endpoint filter', () => {
    const step: PathStep = {
      kind: 'relationBackward',
      fieldId: 'data',
      relationSchemaId: 'relation-schema-1',
      filter: {
        kind: 'predicate',
        path: [{ kind: 'endpoint', direction: 'out' }],
        fieldId: '_id',
        op: 'equals',
        value: 'A'
      }
    };
    expect(pathStepSchema.safeParse(step).success).toBe(true);
  });

  it('rejects a relationBackward step missing relationSchemaId', () => {
    const result = pathStepSchema.safeParse({ kind: 'relationBackward', fieldId: 'data' });
    expect(result.success).toBe(false);
  });
});

describe('compound traversal round trip', () => {
  it('parses a typedRelation step whose filter traverses a relationForward hop', () => {
    const query = {
      kind: 'predicate',
      path: [
        {
          kind: 'typedRelation',
          fieldId: 'flows_in',
          relationSchemaId: 'relation-schema-1',
          direction: 'in',
          ownerSchemaIds: ['entity-schema-1'],
          filter: {
            kind: 'predicate',
            path: [{ kind: 'relationForward', fieldId: 'data' }],
            fieldId: '_name',
            op: 'equals',
            value: 'Address'
          }
        }
      ],
      fieldId: '_id',
      op: 'equals',
      value: 'A'
    };
    expect(queryNodeSchema.safeParse(query).success).toBe(true);
  });
});
