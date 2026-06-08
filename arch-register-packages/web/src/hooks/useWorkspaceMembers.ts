import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchWorkspaceMembers, fetchWorkspaceUsers, updateWorkspaceMemberRole } from '../lib/api';

export const workspaceMembersKeys = {
  all: ['workspace-members'] as const,
  list: (workspaceSlug: string) => [...workspaceMembersKeys.all, workspaceSlug] as const,
  users: (workspaceSlug: string) => [...workspaceMembersKeys.all, workspaceSlug, 'users'] as const
};

export const useWorkspaceMembers = (workspaceSlug: string) => {
  return useQuery({
    queryKey: workspaceMembersKeys.list(workspaceSlug),
    queryFn: () => fetchWorkspaceMembers(workspaceSlug),
    enabled: !!workspaceSlug,
    staleTime: 2 * 60 * 1000
  });
};

export const useWorkspaceUsers = (workspaceSlug: string, enabled = true) => {
  return useQuery({
    queryKey: workspaceMembersKeys.users(workspaceSlug),
    queryFn: () => fetchWorkspaceUsers(workspaceSlug),
    enabled: enabled && !!workspaceSlug,
    staleTime: 2 * 60 * 1000
  });
};

export const useUpdateWorkspaceMemberRole = (workspaceSlug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      updateWorkspaceMemberRole(workspaceSlug, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceMembersKeys.list(workspaceSlug) });
    }
  });
};
