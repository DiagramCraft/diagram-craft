import { describe, expect, it } from 'vitest';
import type { Entity } from '../types.js';
import { toApiEntity, toApiEntitySummary } from './entity-helpers.js';

const now = new Date('2025-06-01T12:00:00.000Z');

const baseEntity: Entity = {
  id: 'e-1',
  workspace: 'ws-1',
  slug: 'my-entity',
  namespace: 'ns',
  name: 'My Entity',
  description: 'A test entity',
  owner: 'team-a',
  lifecycle: 'prod',
  tags: ['a', 'b'],
  links: [{ url: 'https://example.com', title: 'Example' }],
  schema_id: 'schema-1',
  data: { custom: 'value' },
  visibility_mode: 'public',
  created_at: now,
  updated_at: now,
};

// ── toApiEntity ───────────────────────────────────────────────

describe('toApiEntity', () => {
  it('maps all standard fields', () => {
    const result = toApiEntity(baseEntity, null);
    expect(result._uid).toBe('e-1');
    expect(result._workspace).toBe('ws-1');
    expect(result._schemaId).toBe('schema-1');
    expect(result._name).toBe('My Entity');
    expect(result._slug).toBe('my-entity');
    expect(result._namespace).toBe('ns');
    expect(result._description).toBe('A test entity');
    expect(result._owner).toBe('team-a');
    expect(result._lifecycle).toBe('prod');
    expect(result._tags).toEqual(['a', 'b']);
    expect(result._visibilityMode).toBe('public');
  });

  it('spreads entity.data into the result', () => {
    const result = toApiEntity(baseEntity, null);
    expect(result.custom).toBe('value');
  });

  it('grants all capabilities when authCtx is null', () => {
    const result = toApiEntity(baseEntity, null);
    expect(result.canView).toBe(true);
    expect(result.canEdit).toBe(true);
    expect(result.canDelete).toBe(true);
    expect(result.canAdmin).toBe(true);
    expect(result.canCreateChild).toBe(true);
  });
});

// ── toApiEntitySummary ────────────────────────────────────────

describe('toApiEntitySummary', () => {
  it('maps standard fields without data spread', () => {
    const result = toApiEntitySummary(baseEntity, null);
    expect(result._uid).toBe('e-1');
    expect(result._name).toBe('My Entity');
    expect((result as Record<string, unknown>).custom).toBeUndefined();
  });

  it('grants all capabilities when authCtx is null', () => {
    const result = toApiEntitySummary(baseEntity, null);
    expect(result.canView).toBe(true);
  });
});
