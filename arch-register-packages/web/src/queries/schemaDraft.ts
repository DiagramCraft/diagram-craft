import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';

export const schemaDraftKeys = {
  all: ['schema-draft'] as const,
  draft: (workspaceId: string) => [...schemaDraftKeys.all, 'draft', workspaceId] as const,
  mode: (workspaceId: string) => [...schemaDraftKeys.all, 'mode', workspaceId] as const
};

export const schemaDraftQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: schemaDraftKeys.draft(workspaceId),
    queryFn: () => orpcClient.schemaDraft.get({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId
  });

export const schemaChangeModeQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: schemaDraftKeys.mode(workspaceId),
    queryFn: () => orpcClient.schemaDraft.getMode({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId
  });

export const invalidateSchemaDraftQueries = (queryClient: QueryClient, workspaceId: string) =>
  queryClient.invalidateQueries({ queryKey: schemaDraftKeys.draft(workspaceId) });
