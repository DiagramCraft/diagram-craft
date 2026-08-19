import { describe, expect, it } from 'vitest';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  chainMatchesTarget,
  pathStepContextWithFallbackDirection,
  targetSchemaIdsForStep
} from './pathBuilderState';

const makeSchema = (id: string, name: string, fields: EntitySchema['fields'] = []) =>
  ({ id, name, fields, groups: [] }) as unknown as EntitySchema;

describe('pathBuilderState direction fallback and target-schema derivation (#3040-map)', () => {
  const domain = makeSchema('domain', 'Domain');
  const system = makeSchema('system', 'System', [
    {
      id: 'parent',
      name: 'Parent',
      type: 'containment',
      schemaId: 'domain',
      minCount: 0,
      maxCount: 1
    } as never
  ]);

  it("falls back to 'out' when the default 'in' direction has no options", () => {
    // Domain has no outgoing containment field of its own - "System belongs to Domain" only
    // exists as the 'out'/'backward' option (System's own field, walked in reverse).
    const context = pathStepContextWithFallbackDirection({
      rootSchemaScope: ['domain'],
      steps: [],
      depth: 0,
      schemas: [domain, system],
      relationSchemas: []
    });
    expect(context.direction).toBe('out');
    expect(context.options.map(option => option.step)).toEqual([
      { kind: 'backward', fieldId: 'parent', ownerSchemaId: 'system' }
    ]);
  });

  it('leaves an already-populated option list alone', () => {
    const context = pathStepContextWithFallbackDirection({
      rootSchemaScope: 'any',
      steps: [],
      depth: 0,
      schemas: [domain, system],
      relationSchemas: []
    });
    // 'in' (forward fields owned by any in-scope schema) already has System's own field.
    expect(context.direction).toBe('in');
    expect(context.options).toHaveLength(1);
  });

  it('derives the target schema directly from a backward step, without needing a scope', () => {
    expect(
      targetSchemaIdsForStep(
        { kind: 'backward', fieldId: 'parent', ownerSchemaId: 'system' },
        [domain, system],
        []
      )
    ).toEqual(['system']);
  });

  it('derives the target schema for a forward step from the field it names', () => {
    expect(targetSchemaIdsForStep({ kind: 'forward', fieldId: 'parent' }, [domain, system], [])).toEqual(
      ['domain']
    );
  });

  it('chainMatchesTarget matches on the chain leaf, and "any" always matches (#3040-map)', () => {
    const chain = [
      { id: 'domain-1', name: 'Domain One', schemaId: 'domain' },
      { id: 'system-1', name: 'System One', schemaId: 'system' }
    ];
    expect(chainMatchesTarget(chain, 'any')).toBe(true);
    expect(chainMatchesTarget(chain, ['system'])).toBe(true);
    expect(chainMatchesTarget(chain, ['domain'])).toBe(false);
    expect(chainMatchesTarget([], ['system'])).toBe(false);
  });
});
