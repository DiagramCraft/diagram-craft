import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { ExternalContentMount } from '@arch-register/api-types/externalContentContract';
import { orpcClient } from '../lib/orpcClient';
import { workspaceContentKeys } from './content';

export const externalContentKeys = {
  all: ['external-content-mounts'] as const,
  list: (workspaceId: string) => [...externalContentKeys.all, workspaceId] as const
};

export const externalContentQuery = (workspaceId: string, enabled = true) =>
  queryOptions<ExternalContentMount[]>({
    queryKey: externalContentKeys.list(workspaceId),
    queryFn: () => orpcClient.externalContent.list({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId
  });

export const invalidateExternalContent = (queryClient: QueryClient, workspaceId: string) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: externalContentKeys.list(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: workspaceContentKeys.all(workspaceId) })
  ]);
