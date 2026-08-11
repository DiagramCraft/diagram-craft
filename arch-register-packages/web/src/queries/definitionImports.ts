import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import { documentKeys } from './documents';
import { auditKeys } from './audit';
import { dashboardKeys } from './dashboard';
import { enumKeys } from './enums';
import { fieldGroupKeys } from './fieldGroups';
import { relationSchemaKeys } from './relationSchemas';
import { schemaKeys } from './schemaKeys';

export const definitionImportKeys = {
  all: ['definition-import-sources'] as const,
  sources: (workspaceId: string) => [...definitionImportKeys.all, workspaceId] as const
};

export const definitionImportSourcesQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: definitionImportKeys.sources(workspaceId),
    queryFn: () =>
      orpcClient.workspaces.definitionImportSources({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId
  });

export const invalidateDefinitionImportQueries = async (
  queryClient: QueryClient,
  workspaceId: string
) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: schemaKeys.list(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: enumKeys.list(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: documentKeys.typesRoot(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: relationSchemaKeys.list(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: fieldGroupKeys.list(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: dashboardKeys.list(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: auditKeys.workspaceLogs(workspaceId) })
  ]);
};
