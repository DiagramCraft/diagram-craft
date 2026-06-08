import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createWorkspaceRole,
  deleteWorkspaceRole,
  fetchWorkspaceRoles,
  updateWorkspaceRole,
  type WorkspaceRoleDefinition
} from '../lib/api';
import type {
  CreateWorkspaceRoleRequest,
  UpdateWorkspaceRoleRequest
} from '@arch-register/api-types';

export const workspaceRolesKeys = {
  all: ['workspace-roles'] as const,
  list: (workspaceSlug: string) => [...workspaceRolesKeys.all, workspaceSlug] as const
};

export const useWorkspaceRoles = (workspaceSlug: string) =>
  useQuery({
    queryKey: workspaceRolesKeys.list(workspaceSlug),
    queryFn: () => fetchWorkspaceRoles(workspaceSlug),
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
): CreateWorkspaceRoleRequest | UpdateWorkspaceRoleRequest => ({
  name: role.name,
  description: role.description,
  tone: role.tone,
  capabilities: role.capabilities
});

export const useCreateWorkspaceRole = (workspaceSlug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      role: Pick<WorkspaceRoleDefinition, 'name' | 'description' | 'tone' | 'capabilities'>
    ) => createWorkspaceRole(workspaceSlug, toWorkspaceRolePayload(role)),
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
    }) => updateWorkspaceRole(workspaceSlug, roleId, toWorkspaceRolePayload(role)),
    onSuccess: async () => {
      await invalidateWorkspaceRoles(queryClient, workspaceSlug);
    }
  });
};

export const useDeleteWorkspaceRole = (workspaceSlug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (roleId: string) => deleteWorkspaceRole(workspaceSlug, roleId),
    onSuccess: async () => {
      await invalidateWorkspaceRoles(queryClient, workspaceSlug);
    }
  });
};
