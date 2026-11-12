import { describe, expect, it } from 'vitest';
import { applyDraftItems, type CatalogSnapshot } from './draftCatalog';
import { buildMigrationReport, type MigrationUsage } from './draftMigrationReport';
import type { SchemaDbResult } from '../catalog/db/catalogDatabase';

const now = new Date('2026-01-01T00:00:00Z');
const options = { workspace: 'ws', teamIds: new Set<string>(), now };

const schema: SchemaDbResult = {
  id: 'a',
  workspace: 'ws',
  name: 'A',
  description: '',
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'AAA',
  version: 1,
  created_at: now,
  updated_at: now,
  fields: [
    { id: 'old', name: 'Old', type: 'text' },
    { id: 'kept', name: 'Kept', type: 'text' }
  ] as never
};
const live: CatalogSnapshot = {
  schemas: [schema],
  relationSchemas: [],
  documentTypes: [],
  enums: [],
  fieldGroups: [],
  categories: []
};

const usage = (total: number): MigrationUsage => ({
  total,
  counts: new Map([['old', total]]),
  usedFieldIds: new Set(total > 0 ? ['old'] : [])
});

const removeOldField = (fieldMigrations?: unknown) =>
  applyDraftItems(
    live,
    [
      {
        kind: 'entity_schema',
        item_id: 'a',
        op: 'update',
        payload: {
          name: 'A',
          fields: [{ id: 'kept', name: 'Kept', type: 'text' }],
          ...(fieldMigrations ? { fieldMigrations } : {})
        }
      }
    ],
    options
  );

describe('buildMigrationReport', () => {
  it('requires a decision when a removed field has data', async () => {
    const report = await buildMigrationReport(removeOldField(), new Map(), async () => usage(3));
    expect(report).toHaveLength(1);
    expect(report[0]?.unresolved).toMatchObject([{ fieldId: 'old', recordCount: 3 }]);
  });

  it('reports a supplied decision as resolved', async () => {
    const decisions = { old: { action: 'remove' } };
    const report = await buildMigrationReport(
      removeOldField(decisions),
      new Map([['entity_schema:a', { fieldMigrations: decisions as never }]]),
      async () => usage(3)
    );
    expect(report[0]?.unresolved).toEqual([]);
    expect(report[0]?.resolved).toMatchObject([{ fieldId: 'old', decision: 'remove' }]);
  });

  it('reports nothing when there is no data', async () => {
    const report = await buildMigrationReport(removeOldField(), new Map(), async () => usage(0));
    expect(report).toEqual([]);
  });
});
