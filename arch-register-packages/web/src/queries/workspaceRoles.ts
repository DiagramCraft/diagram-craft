import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { WorkspaceRoleDefinition } from '@arch-register/api-types/workspaceContract';
import { orpcClient } from '../lib/orpcClient';

export const workspaceRolesKeys = {
  all: ['workspace-roles'] as const,
  list: (workspaceId: string) => [...workspaceRolesKeys.all, workspaceId] as const
};

export const workspaceRolesQuery = (workspaceId: string) =>
  queryOptions({
    queryKey: workspaceRolesKeys.list(workspaceId),
    queryFn: () => orpcClient.config.roles.list({ params: { workspace: workspaceId } }),
    enabled: !!workspaceId,
    staleTime: 2 * 60 * 1000
  });

export const invalidateWorkspaceRoles = (queryClient: QueryClient, workspaceId: string) =>
  queryClient.invalidateQueries({ queryKey: workspaceRolesKeys.list(workspaceId) });

export const toWorkspaceRolePayload = (
  role: Pick<WorkspaceRoleDefinition, 'name' | 'description' | 'tone' | 'capabilities'>
) => ({
  name: role.name,
  description: role.description ?? '',
  tone: role.tone ?? '',
  capabilities: role.capabilities
});
