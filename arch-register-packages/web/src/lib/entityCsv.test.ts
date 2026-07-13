import { beforeEach, describe, expect, it, vi } from 'vitest';
import { commitCsvImport, parseCsvImport } from './entityCsv';

const importParseMock = vi.fn();
const importCommitMock = vi.fn();

vi.mock('./orpcClient', () => ({
  orpcClient: {
    entities: {
      importParse: importParseMock,
      importCommit: importCommitMock
    }
  }
}));

beforeEach(() => {
  importParseMock.mockReset();
  importCommitMock.mockReset();
});

describe('CSV import helpers', () => {
  it('routes parseCsvImport through the ORPC client', async () => {
    const result = {
      schemaId: 'schema-1',
      schemaName: 'Application',
      totalRows: 2,
      validRows: 1,
      entities: [
        {
          rowNumber: 1,
          errors: [],
          entity: { _name: 'Payments API' },
          isUpdate: false
        }
      ]
    };
    importParseMock.mockResolvedValue(result);

    await expect(parseCsvImport('demo', 'schema-1', 'name\nPayments API\n')).resolves.toEqual(
      result
    );
    expect(importParseMock).toHaveBeenCalledWith({
      params: { workspace: 'demo' },
      body: { schemaId: 'schema-1', csvContent: 'name\nPayments API\n' }
    });
  });

  it('routes commitCsvImport through the ORPC client', async () => {
    const entities = [{ _name: 'Payments API', _schemaId: 'schema-1' }];
    const result = { created: 1, updated: 0, ids: ['entity-1'] };
    importCommitMock.mockResolvedValue(result);

    await expect(commitCsvImport('demo', 'schema-1', entities)).resolves.toEqual(result);
    expect(importCommitMock).toHaveBeenCalledWith({
      params: { workspace: 'demo' },
      body: { schemaId: 'schema-1', entities }
    });
  });
});
