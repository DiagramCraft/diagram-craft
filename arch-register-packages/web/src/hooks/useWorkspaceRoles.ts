import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import type { WorkspaceRoleDefinition } from '@arch-register/api-types/workspaceContract';

export const workspaceRolesKeys = {
  all: ['workspace-roles'] as const,
  list: (workspaceSlug: string) => [...workspaceRolesKeys.all, workspaceSlug] as const
};

export const useWorkspaceRoles = (workspaceSlug: string) =>
  useQuery({
    queryKey: workspaceRolesKeys.list(workspaceSlug),
    queryFn: () => orpcClient.config.roles.list({ params: { workspace: workspaceSlug } }),
    enabled: !!workspaceSlug,
    staleTime: 2 * 60 * 1000
  });

const invalidateWorkspaceRoles = async (
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceSlug: string
) => {
  await queryClient.invalidateQueries({ queryKey: workspaceRolesKeys.list(workspaceSlug) });
};

const toWorkspaceRolePayload = (
  role: Pick<WorkspaceRoleDefinition, 'name' | 'description' | 'tone' | 'capabilities'>
) => ({
  name: role.name,
  description: role.description ?? '',
  tone: role.tone ?? '',
  capabilities: role.capabilities
});

export const useCreateWorkspaceRole = (workspaceSlug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      role: Pick<WorkspaceRoleDefinition, 'name' | 'description' | 'tone' | 'capabilities'>
    ) =>
      orpcClient.config.roles.create({
        params: { workspace: workspaceSlug },
        body: toWorkspaceRolePayload(role)
      }),
    onSuccess: async () => {
      await invalidateWorkspaceRoles(queryClient, workspaceSlug);
    }
  });
};

export const useUpdateWorkspaceRole = (workspaceSlug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      roleId,
      role
    }: {
      roleId: string;
      role: Pick<WorkspaceRoleDefinition, 'name' | 'description' | 'tone' | 'capabilities'>;
    }) =>
      orpcClient.config.roles.update({
        params: { workspace: workspaceSlug, id: roleId },
        body: toWorkspaceRolePayload(role)
      }),
    onSuccess: async () => {
      await invalidateWorkspaceRoles(queryClient, workspaceSlug);
    }
  });
};

export const useDeleteWorkspaceRole = (workspaceSlug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (roleId: string) =>
      orpcClient.config.roles.remove({
        params: { workspace: workspaceSlug, id: roleId }
      }),
    onSuccess: async () => {
      await invalidateWorkspaceRoles(queryClient, workspaceSlug);
    }
  });
};
