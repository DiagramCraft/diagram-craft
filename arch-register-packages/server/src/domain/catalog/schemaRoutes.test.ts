import { describe, expect, it } from 'vitest';
import {
  buildCreateSchemaInput,
  buildUpdateSchemaInput,
  isSchemaReferencedByEntities,
  resolveSchemaDefaultOwner
} from './schemaRoutes';
import type { EntitySchema } from '../../types';

const now = new Date('2026-06-01T12:00:00.000Z');

const baseSchema: EntitySchema = {
  id: 'schema-1',
  workspace: 'default',
  name: 'Component',
  description: 'Original',
  fields: [{ id: 'technology', name: 'Technology', type: 'text' }],
  color: '#123456',
  icon: 'box',
  default_owner: 'Platform Engineering',
  created_at: now,
  updated_at: now
};

describe('schema route helpers', () => {
  it('resolves schema default owners only when the team exists', () => {
    const teamIds = new Set(['Platform Engineering', 'Design Systems']);
    expect(resolveSchemaDefaultOwner('Design Systems', teamIds, null)).toBe('Design Systems');
    expect(resolveSchemaDefaultOwner('Missing Team', teamIds, 'Platform Engineering')).toBe(
      'Platform Engineering'
    );
    expect(resolveSchemaDefaultOwner(null, teamIds, null)).toBeNull();
  });

  it('builds create schema input with normalized optional fields', () => {
    const input = buildCreateSchemaInput(
      'default',
      {
        name: 'Service',
        description: 1,
        fields: 'invalid',
        color: 2,
        icon: 'server',
        default_owner: 'Missing Team'
      },
      new Set(['Platform Engineering']),
      now,
      () => 'schema-created'
    );

    expect(input).toEqual({
      id: 'schema-created',
      workspace: 'default',
      name: 'Service',
      description: '',
      fields: [],
      color: null,
      icon: 'server',
      default_owner: null,
      created_at: now,
      updated_at: now
    });
  });

  it('builds update schema input preserving omitted fields', () => {
    const input = buildUpdateSchemaInput(
      {
        name: 'Service'
      },
      baseSchema,
      new Set(['Platform Engineering', 'Design Systems']),
      now
    );

    expect(input).toEqual({
      name: 'Service',
      description: 'Original',
      fields: [{ id: 'technology', name: 'Technology', type: 'text' }],
      color: '#123456',
      icon: 'box',
      defaultOwner: 'Platform Engineering',
      updated_at: now
    });
  });

  it('builds update schema input with explicit normalized values', () => {
    const input = buildUpdateSchemaInput(
      {
        name: 'Service',
        description: 42,
        fields: [{ id: 'lifecycle', name: 'Lifecycle', type: 'text' }],
        color: null,
        icon: 5,
        default_owner: 'Design Systems'
      },
      baseSchema,
      new Set(['Platform Engineering', 'Design Systems']),
      now
    );

    expect(input).toEqual({
      name: 'Service',
      description: '',
      fields: [{ id: 'lifecycle', name: 'Lifecycle', type: 'text' }],
      color: null,
      icon: null,
      defaultOwner: 'Design Systems',
      updated_at: now
    });
  });

  it('detects when entities still reference a schema', () => {
    expect(
      isSchemaReferencedByEntities('schema-1', [
        { schema_id: 'schema-2' },
        { schema_id: 'schema-1' }
      ])
    ).toBe(true);
    expect(isSchemaReferencedByEntities('schema-1', [{ schema_id: 'schema-2' }])).toBe(false);
  });
});
