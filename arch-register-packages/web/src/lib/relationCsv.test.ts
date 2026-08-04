import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  commitRelationCsvImport,
  downloadRelationCsvTemplate,
  exportRelationsToCSV,
  parseRelationCsvImport
} from './relationCsv';

const exportCsvMock = vi.fn();
const downloadTemplateMock = vi.fn();
const importParseMock = vi.fn();
const importCommitMock = vi.fn();

vi.mock('./orpcClient', () => ({
  orpcClient: {
    relations: {
      exportCsv: exportCsvMock,
      downloadTemplate: downloadTemplateMock,
      importParse: importParseMock,
      importCommit: importCommitMock
    }
  }
}));

beforeEach(() => {
  exportCsvMock.mockReset();
  downloadTemplateMock.mockReset();
  importParseMock.mockReset();
  importCommitMock.mockReset();
});

describe('relation CSV client helpers', () => {
  it('serializes the relation query for export', async () => {
    const blob = new Blob(['_schemaId']);
    exportCsvMock.mockResolvedValue({ body: blob });
    const query = { root_kind: 'relation' as const, root: { kind: 'and' as const, children: [] } };

    await expect(exportRelationsToCSV('workspace-1', query)).resolves.toBe(blob);
    expect(exportCsvMock).toHaveBeenCalledWith({
      params: { workspace: 'workspace-1' },
      query: { relationQuery: JSON.stringify(query) }
    });
  });

  it('routes template, parse, and commit calls through the relation API', async () => {
    const blob = new Blob(['template']);
    downloadTemplateMock.mockResolvedValue({ body: blob });
    importParseMock.mockResolvedValue({ totalRows: 1, validRows: 1, relations: [] });
    importCommitMock.mockResolvedValue({ created: 1, updated: 0, ids: ['relation-1'] });

    await expect(downloadRelationCsvTemplate('workspace-1', 'schema-1')).resolves.toBe(blob);
    await expect(parseRelationCsvImport('workspace-1', 'csv')).resolves.toMatchObject({
      totalRows: 1
    });
    await expect(
      commitRelationCsvImport('workspace-1', [{ _schemaId: 'schema-1' }])
    ).resolves.toEqual({
      created: 1,
      updated: 0,
      ids: ['relation-1']
    });

    expect(downloadTemplateMock).toHaveBeenCalledWith({
      params: { workspace: 'workspace-1', id: 'schema-1' }
    });
    expect(importParseMock).toHaveBeenCalledWith({
      params: { workspace: 'workspace-1' },
      body: { csvContent: 'csv' }
    });
    expect(importCommitMock).toHaveBeenCalledWith({
      params: { workspace: 'workspace-1' },
      body: { relations: [{ _schemaId: 'schema-1' }] }
    });
  });
});
