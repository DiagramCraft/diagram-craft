import { describe, expect, it } from 'vitest';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import {
  findRootSchema,
  isPathWalkerConfigComplete,
  isPathWalkerConfigValid,
  resolveWalkerHops
} from './pathWalkerWidgetLogic';

const hop = (relationSchemaId: string) => ({
  kind: 'unboundTypedRelation' as const,
  relationSchemaId,
  direction: 'in' as const
});

describe('isPathWalkerConfigValid', () => {
  it('accepts a root schema with or without hops', () => {
    expect(isPathWalkerConfigValid({ rootSchemaName: 'Objective' })).toBe(true);
    expect(isPathWalkerConfigValid({ rootSchemaName: 'Objective', hops: [hop('Rel')] })).toBe(true);
  });

  it('rejects wrong types and malformed hops', () => {
    expect(isPathWalkerConfigValid({})).toBe(false);
    expect(isPathWalkerConfigValid({ rootSchemaName: 'Objective', hops: 'x' })).toBe(false);
    expect(isPathWalkerConfigValid({ rootSchemaName: 'Objective', hops: [{ kind: 'nope' }] })).toBe(
      false
    );
    expect(isPathWalkerConfigValid({ rootSchemaName: 'Objective', label: 3 })).toBe(false);
  });
});

describe('isPathWalkerConfigComplete', () => {
  it('requires a root schema', () => {
    expect(isPathWalkerConfigComplete({ rootSchemaName: '' })).toBe(false);
    expect(isPathWalkerConfigComplete({ rootSchemaName: 'Objective' })).toBe(true);
  });
});

describe('findRootSchema', () => {
  const schemas = [
    { id: 's1', name: 'Objective' },
    { id: 's2', name: 'Capability' }
  ] as unknown as EntitySchema[];

  it('matches by id or by name', () => {
    expect(findRootSchema({ rootSchemaName: 's2' }, schemas)?.name).toBe('Capability');
    expect(findRootSchema({ rootSchemaName: 'Objective' }, schemas)?.id).toBe('s1');
    expect(findRootSchema({ rootSchemaName: 'Nope' }, schemas)).toBeUndefined();
  });
});

describe('resolveWalkerHops', () => {
  const relationSchemas = [{ id: 'r1', name: 'Supports' }] as unknown as RelationSchema[];

  it('resolves relation schema names to ids and leaves real ids alone', () => {
    const resolved = resolveWalkerHops(
      { rootSchemaName: 'A', hops: [hop('Supports'), hop('r1')] },
      relationSchemas
    );
    expect(resolved.map(step => (step as { relationSchemaId: string }).relationSchemaId)).toEqual([
      'r1',
      'r1'
    ]);
  });

  it('returns an empty chain when none is configured', () => {
    expect(resolveWalkerHops({ rootSchemaName: 'A' }, relationSchemas)).toEqual([]);
  });
});
