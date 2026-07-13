type FetchEntitiesOptions = {
  schemaId?: string | null;
  owner?: string | null;
  lifecycle?: string | null;
  q?: string | null;
  view?: 'summary' | 'full';
  limit?: number | null;
  offset?: number | null;
};

export const exportEntitiesToCSV = async (
  workspace: string,
  options: FetchEntitiesOptions = {}
): Promise<Blob> => {
  const { orpcClient } = await import('./orpcClient');
  const result = await orpcClient.entities.exportCsv({
    params: { workspace },
    query: {
      _schemaId: options.schemaId ?? undefined,
      owner: options.owner ?? undefined,
      lifecycle: options.lifecycle ?? undefined,
      q: options.q ?? undefined
    }
  });
  return result.body;
};

export const downloadCsvTemplate = async (workspace: string, schemaId: string): Promise<Blob> => {
  const { orpcClient } = await import('./orpcClient');
  const result = await orpcClient.entities.downloadTemplate({
    params: { workspace, schemaId }
  });
  return result.body;
};

export const parseCsvImport = async (
  workspace: string,
  schemaId: string,
  csvContent: string
): Promise<{
  schemaId: string;
  schemaName: string;
  totalRows: number;
  validRows: number;
  entities: Array<{
    rowNumber: number;
    errors: string[];
    entity: Record<string, unknown> | null;
    isUpdate: boolean;
    matchType?: 'id' | 'slug' | 'name' | 'none';
    nameMatches?: Array<{ id: string; name: string; slug?: string; namespace?: string }>;
    existingId?: string;
    existingEntity?: Record<string, unknown> | null;
    constraintViolations?: Array<{
      type: 'duplicate_slug' | 'wrong_workspace' | 'wrong_schema';
      message: string;
    }>;
  }>;
}> => {
  const { orpcClient } = await import('./orpcClient');
  const result = await orpcClient.entities.importParse({
    params: { workspace },
    body: { schemaId, csvContent }
  });

  return {
    ...result,
    entities: result.entities.map(entity => ({
      ...entity,
      nameMatches: entity.nameMatches?.map(match => ({
        id: match.id,
        name: match.name,
        slug: match.slug,
        namespace: match.namespace
      })),
      existingId: entity.existingId ?? undefined
    }))
  };
};

export const commitCsvImport = async (
  workspace: string,
  schemaId: string,
  entities: Array<Record<string, unknown>>
): Promise<{ created: number; updated: number; ids: string[] }> => {
  const { orpcClient } = await import('./orpcClient');
  return orpcClient.entities.importCommit({
    params: { workspace },
    body: { schemaId, entities }
  });
};
