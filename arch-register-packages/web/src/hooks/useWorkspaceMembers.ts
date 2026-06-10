import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';

export const workspaceMembersKeys = {
  all: ['workspace-members'] as const,
  list: (workspaceSlug: string) => [...workspaceMembersKeys.all, workspaceSlug] as const,
  users: (workspaceSlug: string) => [...workspaceMembersKeys.all, workspaceSlug, 'users'] as const
};

export const useWorkspaceMembers = (workspaceSlug: string) => {
  return useQuery({
    queryKey: workspaceMembersKeys.list(workspaceSlug),
    queryFn: () => orpcClient.config.members.list({ params: { workspace: workspaceSlug } }),
    enabled: !!workspaceSlug,
    staleTime: 2 * 60 * 1000
  });
};

export const useWorkspaceUsers = (workspaceSlug: string, enabled = true) => {
  return useQuery({
    queryKey: workspaceMembersKeys.users(workspaceSlug),
    queryFn: () => orpcClient.config.users.list({ params: { workspace: workspaceSlug } }),
    enabled: enabled && !!workspaceSlug,
    staleTime: 2 * 60 * 1000
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
      queryClient.invalidateQueries({ queryKey: workspaceMembersKeys.list(workspaceSlug) });
    }
  });
};
