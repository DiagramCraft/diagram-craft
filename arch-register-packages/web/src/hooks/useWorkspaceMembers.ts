import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import {
  invalidateWorkspaceMembers,
  workspaceMembersKeys as workspaceMembersKeysFromQueries,
  workspaceMembersQuery,
  workspaceUsersQuery
} from '../queries/workspaceMembers';

export const workspaceMembersKeys = workspaceMembersKeysFromQueries;

export const useWorkspaceMembers = (workspaceSlug: string) => {
  return useQuery({
    ...workspaceMembersQuery(workspaceSlug)
  });
};

export const useWorkspaceUsers = (
  workspaceSlug: string,
  enabled = true,
  options: { q?: string; limit?: number } = {}
) => {
  return useQuery({
    ...workspaceUsersQuery(workspaceSlug, options, enabled)
  });
};

export const useUpdateWorkspaceMemberRole = (workspaceSlug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      orpcClient.config.members.updateRole({
        params: { workspace: workspaceSlug, id: userId },
        body: { roleId: role }
      }),
    onSuccess: () => {
      invalidateWorkspaceMembers(queryClient, workspaceSlug);
    }
  });
};
