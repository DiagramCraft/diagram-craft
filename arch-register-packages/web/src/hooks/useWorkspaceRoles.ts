import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { WorkspaceRoleDefinition } from '@arch-register/api-types/workspaceContract';
import {
  invalidateWorkspaceRoles,
  toWorkspaceRolePayload,
  workspaceRolesKeys as workspaceRolesKeysFromQueries,
  workspaceRolesQuery
} from '../queries/workspaceRoles';
import { orpcClient } from '../lib/orpcClient';

export const workspaceRolesKeys = workspaceRolesKeysFromQueries;

export const useWorkspaceRoles = (workspaceSlug: string) =>
  useQuery({
    ...workspaceRolesQuery(workspaceSlug)
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
