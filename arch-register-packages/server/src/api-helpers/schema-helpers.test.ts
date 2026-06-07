import { describe, expect, it } from 'vitest';
import type { EntitySchema, WorkspaceEnum } from '../types';
import { toApiEnum, toApiSchema } from './schema-helpers';

const now = new Date('2025-06-01T12:00:00.000Z');
const nowIso = '2025-06-01T12:00:00.000Z';

// ── toApiEnum ─────────────────────────────────────────────────

describe('toApiEnum', () => {
  it('maps fields and serializes dates to ISO strings', () => {
    const e: WorkspaceEnum = {
      id: 'enum-1',
      workspace: 'ws-1',
      name: 'Status',
      options: [{ value: 'active', label: 'Active' }],
      sort_order: 0,
      created_at: now,
      updated_at: now
    };
    const result = toApiEnum(e);
    expect(result.id).toBe('enum-1');
    expect(result.options).toEqual([{ value: 'active', label: 'Active' }]);
    expect(result.created_at).toBe(nowIso);
    expect(result.updated_at).toBe(nowIso);
  });
});

// ── toApiSchema ───────────────────────────────────────────────

describe('toApiSchema', () => {
  const baseEnum: WorkspaceEnum = {
    id: 'enum-env',
    workspace: 'ws-1',
    name: 'Env',
    options: [{ value: 'prod', label: 'Production' }],
    sort_order: 0,
    created_at: now,
    updated_at: now
  };

  const schema: EntitySchema = {
    id: 'schema-1',
    workspace: 'ws-1',
    name: 'Application',
    description: 'desc',
    fields: [
      { id: 'env', name: 'Env', type: 'select', enumId: 'enum-env' },
      { id: 'notes', name: 'Notes', type: 'text' },
      { id: 'go_live', name: 'Go Live', type: 'date' }
    ],
    color: null,
    icon: null,
    default_owner: null,
    created_at: now,
    updated_at: now
  };

  it('resolves options for select fields', () => {
    const result = toApiSchema(schema, 5, [baseEnum]);
    const envField = result.fields.find(f => f.id === 'env') as Record<string, unknown>;
    expect(envField?.options).toEqual([{ value: 'prod', label: 'Production' }]);
  });

  it('falls back to empty options when enum is missing', () => {
    const result = toApiSchema(schema, 5, []);
    const envField = result.fields.find(f => f.id === 'env') as Record<string, unknown>;
    expect(envField?.options).toEqual([]);
  });

  it('leaves non-select fields unchanged', () => {
    const result = toApiSchema(schema, 5, []);
    const notesField = result.fields.find(f => f.id === 'notes');
    expect(notesField).toEqual({ id: 'notes', name: 'Notes', type: 'text' });
  });

  it('passes through date fields unchanged', () => {
    const result = toApiSchema(schema, 5, []);
    const dateField = result.fields.find(f => f.id === 'go_live');
    expect(dateField).toEqual({ id: 'go_live', name: 'Go Live', type: 'date' });
  });

  it('includes entity count and serializes dates', () => {
    const result = toApiSchema(schema, 42, []);
    expect(result.entity_count).toBe(42);
    expect(result.created_at).toBe(nowIso);
  });
});
