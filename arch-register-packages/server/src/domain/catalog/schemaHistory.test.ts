import { describe, expect, it } from 'vitest';
import type { FieldGroupSchemaShape } from '../auth/fieldGroupAccessControl';
import { selectSchemaAt } from './schemaHistory';

const visibleSchema = {
  fields: [{ id: 'secret', name: 'Secret', type: 'text' }],
  groups: []
} as FieldGroupSchemaShape;

const restrictedSchema = {
  fields: [{ id: 'secret', name: 'Secret', type: 'text', groupId: 'restricted' }],
  groups: [{ id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-1'] } }]
} as FieldGroupSchemaShape;

describe('selectSchemaAt', () => {
  it('uses the newest schema version at or before the requested time', () => {
    const selected = selectSchemaAt(
      { ...visibleSchema, created_at: new Date('2026-03-01') },
      [
        { ...restrictedSchema, created_at: new Date('2026-01-01') },
        { ...visibleSchema, created_at: new Date('2026-02-01') }
      ],
      new Date('2026-01-15')
    );

    expect(selected?.groups).toEqual(restrictedSchema.groups);
  });

  it('returns no schema when the schema did not exist yet', () => {
    expect(
      selectSchemaAt(
        { ...visibleSchema, created_at: new Date('2026-03-01') },
        [],
        new Date('2026-02-01')
      )
    ).toBeNull();
  });

  it('uses a historical schema even when the current schema changed access', () => {
    const selected = selectSchemaAt(
      { ...visibleSchema, created_at: new Date('2026-02-01') },
      [{ ...restrictedSchema, created_at: new Date('2026-01-01') }],
      new Date('2026-01-15')
    );

    expect(selected?.fields[0]?.groupId).toBe('restricted');
  });
});
