import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Workspace } from '../api';
import { apiFetch } from '../api';

// Query keys factory
export const workspaceKeys = {
  all: ['workspaces'] as const,
  lists: () => [...workspaceKeys.all, 'list'] as const,
  list: () => [...workspaceKeys.lists()] as const,
  details: () => [...workspaceKeys.all, 'detail'] as const,
  detail: (workspaceId: string) => [...workspaceKeys.details(), workspaceId] as const,
};

// Hook for fetching workspaces
export const useWorkspaces = () => {
  return useQuery({
    queryKey: workspaceKeys.list(),
    queryFn: async () => {
      return await apiFetch<Workspace[]>('/api/workspaces');
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Hook for updating a workspace
export const useUpdateWorkspace = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workspaceId,
      data,
    }: {
      workspaceId: string;
      data: {
        name: string;
        url_slug: string;
        short_code: string;
        description: string;
      };
    }) =>
      apiFetch<Workspace>(`/api/workspaces/${workspaceId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: (updatedWorkspace, variables) => {
      // Update the workspace detail cache
      queryClient.setQueryData(
        workspaceKeys.detail(variables.workspaceId),
        updatedWorkspace
      );
      // Invalidate workspace list to reflect changes
      queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
    },
  });
};

// Hook for deleting a workspace
export const useDeleteWorkspace = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workspaceId: string) =>
      apiFetch<{ success: boolean }>(`/api/workspaces/${workspaceId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      // Invalidate all workspace queries
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
};