import { describe, expect, it } from 'vitest';
import { computeEntityCompleteness } from './completeness';
import { Entity, SchemaDbResult } from '../domain/catalog/db/catalogDatabase';

const now = new Date('2025-06-01T12:00:00.000Z');

describe('computeEntityCompleteness', () => {
  it('counts required and expected fields, ignores optional fields, and treats false as filled', () => {
    const entity: Entity = {
      id: 'e-1',
      workspace: 'ws-1',
      public_id: 'ENT-1',
      slug: 'my-entity',
      namespace: 'ns',
      name: 'My Entity',
      description: '  ',
      owner: 'team-a',
      lifecycle: null,
      target_lifecycle: null,
      target_lifecycle_date: null,
      tags: [],
      links: [],
      schema_id: 'schema-1',
      data: {
        isCritical: false,
        notes: 'ready',
        optionalField: ''
      },
      project_id: null,
      created_at: now,
      updated_at: now,
      completeness: 0
    };

    const schema: SchemaDbResult = {
      id: 'schema-1',
      workspace: 'ws-1',
      name: 'Application',
      description: 'desc',
      fields: [
        { id: 'isCritical', name: 'Critical', type: 'boolean', requirementLevel: 'required' },
        { id: 'notes', name: 'Notes', type: 'text', requirementLevel: 'expected' },
        { id: 'optionalField', name: 'Optional', type: 'text', requirementLevel: 'optional' }
      ],
      color: null,
      icon: null,
      default_owner: null,
      key_prefix: 'APP',
      created_at: now,
      updated_at: now
    };

    expect(computeEntityCompleteness(entity, schema)).toBe(60);
  });
});
