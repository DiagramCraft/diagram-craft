import { beforeEach, describe, expect, it, vi } from 'vitest';
import { commitCsvImport, exportEntitiesToCSV, parseCsvImport } from './entityCsv';

const importParseMock = vi.fn();
const importCommitMock = vi.fn();
const exportCsvMock = vi.fn();

vi.mock('./orpcClient', () => ({
  orpcClient: {
    entities: {
      importParse: importParseMock,
      importCommit: importCommitMock,
      exportCsv: exportCsvMock
    }
  }
}));

beforeEach(() => {
  importParseMock.mockReset();
  importCommitMock.mockReset();
  exportCsvMock.mockReset();
});

describe('exportEntitiesToCSV', () => {
  it('forwards conditions and a JSON-serialized entityQuery to the exportCsv route', async () => {
    const blob = new Blob(['id;name'], { type: 'text/csv' });
    exportCsvMock.mockResolvedValue({ body: blob });

    const conditions = [{ fieldId: '_lifecycle', op: 'equals' as const, value: 'active' }];
    const entityQuery = { root: { kind: 'freeText' as const, value: 'payments' } };

    const result = await exportEntitiesToCSV('demo', {
      schemaId: 'application',
      owner: 'team-1',
      lifecycle: 'active',
      q: 'payments',
      conditions,
      entityQuery,
      collectionId: 'collection-1'
    });

    expect(result).toBe(blob);
    expect(exportCsvMock).toHaveBeenCalledWith({
      params: { workspace: 'demo' },
      query: {
        _schemaId: 'application',
        owner: 'team-1',
        lifecycle: 'active',
        q: 'payments',
        conditions,
        entityQuery: JSON.stringify(entityQuery),
        assessmentId: undefined,
        projectId: undefined,
        projectScope: undefined,
        collectionId: 'collection-1',
        asOf: undefined,
        includeProjectSnapshots: undefined
      }
    });
  });
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
