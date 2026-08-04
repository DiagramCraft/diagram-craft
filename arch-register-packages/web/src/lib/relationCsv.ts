import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';

export const exportRelationsToCSV = async (
  workspace: string,
  relationQuery: EntityQuery
): Promise<Blob> => {
  const { orpcClient } = await import('./orpcClient');
  const result = await orpcClient.relations.exportCsv({
    params: { workspace },
    query: { relationQuery: JSON.stringify(relationQuery) }
  });
  return result.body;
};

export const downloadRelationCsvTemplate = async (
  workspace: string,
  schemaId: string
): Promise<Blob> => {
  const { orpcClient } = await import('./orpcClient');
  const result = await orpcClient.relations.downloadTemplate({
    params: { workspace, id: schemaId }
  });
  return result.body;
};

export type RelationImportRow = {
  rowNumber: number;
  errors: string[];
  relation: Record<string, unknown> | null;
  isUpdate: boolean;
  existingId?: string;
  matchType?: 'natural-key' | 'none';
};

export const parseRelationCsvImport = async (
  workspace: string,
  csvContent: string
): Promise<{
  totalRows: number;
  validRows: number;
  relations: RelationImportRow[];
}> => {
  const { orpcClient } = await import('./orpcClient');
  return orpcClient.relations.importParse({
    params: { workspace },
    body: { csvContent }
  });
};

export const commitRelationCsvImport = async (
  workspace: string,
  relations: Array<Record<string, unknown>>
): Promise<{ created: number; updated: number; ids: string[] }> => {
  const { orpcClient } = await import('./orpcClient');
  return orpcClient.relations.importCommit({
    params: { workspace },
    body: { relations }
  });
};
