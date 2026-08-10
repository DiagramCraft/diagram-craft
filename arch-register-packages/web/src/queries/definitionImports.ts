import type { QueryClient } from '@tanstack/react-query';
import { documentKeys } from '../hooks/useDocuments';
import { auditKeys } from './audit';
import { dashboardKeys } from './dashboard';
import { enumKeys } from './enums';
import { fieldGroupKeys } from './fieldGroups';
import { relationSchemaKeys } from './relationSchemas';
import { schemaKeys } from './schemas';

export const definitionImportKeys = {
  all: ['definition-import-sources'] as const,
  sources: (workspaceId: string) => [...definitionImportKeys.all, workspaceId] as const
};

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
