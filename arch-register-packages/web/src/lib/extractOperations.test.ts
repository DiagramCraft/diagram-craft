import { beforeEach, describe, expect, it, vi } from 'vitest';

const { bulkCreate } = vi.hoisted(() => ({ bulkCreate: vi.fn() }));

vi.mock('./orpcClient', () => ({
  orpcClient: { entities: { bulkCreate } }
}));

import { createExtractedEntities } from './extractOperations';

describe('createExtractedEntities', () => {
  beforeEach(() => bulkCreate.mockReset());

  it('commits the complete extraction with exactly one bulk request', async () => {
    bulkCreate.mockResolvedValue([]);

    await createExtractedEntities('ws-1', [
      { name: 'A', schemaId: 'schema-1', fields: { depends_on: 'B' } },
      { name: 'B', schemaId: 'schema-1', fields: { depends_on: 'A' } }
    ]);

    expect(bulkCreate).toHaveBeenCalledOnce();
    expect(bulkCreate).toHaveBeenCalledWith({
      params: { workspace: 'ws-1' },
      body: {
        entities: [
          {
            _schemaId: 'schema-1',
            _name: 'A',
            _description: '',
            depends_on: 'B'
          },
          {
            _schemaId: 'schema-1',
            _name: 'B',
            _description: '',
            depends_on: 'A'
          }
        ]
      }
    });
  });
});
