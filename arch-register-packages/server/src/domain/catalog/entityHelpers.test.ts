import { describe, expect, it } from 'vitest';
import type { EntityDbResult } from './db/catalogDatabase';
import { toApiEntity, toApiEntitySummary } from './entityHelpers';

const now = new Date('2025-06-01T12:00:00.000Z');

const baseEntity: EntityDbResult = {
  id: 'e-1',
  workspace: 'ws-1',
  public_id: 'ENT-1',
  slug: 'my-entity',
  namespace: 'ns',
  name: 'My Entity',
  description: 'A test entity',
  owner: 'team-a',
  lifecycle: 'lc-1',
  target_lifecycle: null,
  target_lifecycle_date: null,
  tags: ['a', 'b'],
  links: [{ url: 'https://example.com', title: 'Example' }],
  schema_id: 'schema-1',
  data: { custom: 'value' },
  visibility_mode: 'public',
  created_at: now,
  updated_at: now,
  owner_name: 'Team A',
  lifecycle_label: 'Production',
  target_lifecycle_label: null,
  schema_name: 'Service'
};

// ── toApiEntity ───────────────────────────────────────────────

describe('toApiEntity', () => {
  it('maps all standard fields', () => {
    const result = toApiEntity(baseEntity, null);
    expect(result._uid).toBe('e-1');
    expect(result._schema).toEqual({ id: 'schema-1', name: 'Service' });
    expect(result._name).toBe('My Entity');
    expect(result._slug).toBe('my-entity');
    expect(result._namespace).toBe('ns');
    expect(result._description).toBe('A test entity');
    expect(result._owner).toEqual({ id: 'team-a', name: 'Team A' });
    expect(result._lifecycle).toEqual({ id: 'lc-1', name: 'Production' });
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
