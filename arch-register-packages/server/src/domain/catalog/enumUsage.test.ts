import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import { listUsedEnumOptionValues } from './enumUsage';

describe('listUsedEnumOptionValues', () => {
  it('collects scalar, multi-valued, and relation enum values', async () => {
    const listSchemas = vi.fn(async () => [
      {
        id: 'entity-schema',
        fields: [
          { id: 'classification', name: 'Classification', type: 'select', enumId: 'enum-1' },
          { id: 'other', name: 'Other', type: 'text' }
        ]
      }
    ]);
    const listRelationSchemas = vi.fn(async () => [
      {
        id: 'relation-schema',
        fields: [{ id: 'purposes', name: 'Purposes', type: 'select', enumId: 'enum-1' }]
      }
    ]);
    const listEntities = vi.fn(async () => [
      { schema_id: 'entity-schema', data: { classification: 'sensitive' } }
    ]);
    const listRelations = vi.fn(async () => ({
      items: [
        {
          schema_id: 'relation-schema',
          data: { purposes: ['support', 'analytics'] }
        }
      ],
      total: 1
    }));
    const db = {
      catalog: { listSchemas, listEntities },
      relation: { listRelationSchemas, listRelations }
    } as unknown as DatabaseAdapter;

    await expect(listUsedEnumOptionValues(db, 'workspace-1', 'enum-1')).resolves.toEqual(
      new Set(['sensitive', 'support', 'analytics'])
    );
    expect(listRelations).toHaveBeenCalledWith('workspace-1', {}, { limit: 200, offset: 0 });
  });
});
