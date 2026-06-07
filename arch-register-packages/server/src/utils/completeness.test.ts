import { describe, expect, it } from 'vitest';
import type { Entity, EntitySchema } from '../types';
import { computeEntityCompleteness } from './completeness';

const now = new Date('2025-06-01T12:00:00.000Z');

describe('computeEntityCompleteness', () => {
  it('counts required and expected fields, ignores optional fields, and treats false as filled', () => {
    const entity: Entity = {
      id: 'e-1',
      workspace: 'ws-1',
      slug: 'my-entity',
      namespace: 'ns',
      name: 'My Entity',
      description: '  ',
      owner: 'team-a',
      lifecycle: null,
      tags: [],
      links: [],
      schema_id: 'schema-1',
      data: {
        isCritical: false,
        notes: 'ready',
        optionalField: ''
      },
      visibility_mode: 'public',
      created_at: now,
      updated_at: now
    };

    const schema: EntitySchema = {
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
      created_at: now,
      updated_at: now
    };

    expect(computeEntityCompleteness(entity, schema)).toBe(60);
  });
});
