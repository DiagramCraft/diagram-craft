import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { auditKeys, invalidateAuditQueries } from './useAudit';
import { orpcClient } from '../lib/orpcClient';

// Query keys factory
export const workspaceKeys = {
  all: ['workspaces'] as const,
  lists: () => [...workspaceKeys.all, 'list'] as const,
  list: () => [...workspaceKeys.lists()] as const,
  details: () => [...workspaceKeys.all, 'detail'] as const,
  detail: (workspaceId: string) => [...workspaceKeys.details(), workspaceId] as const
};

// Hook for fetching workspaces
export const useWorkspaces = () => {
  return useQuery({
    queryKey: workspaceKeys.list(),
    queryFn: () => orpcClient.workspaces.list({}),
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
};

// Hook for updating a workspace
export const useUpdateWorkspace = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workspaceId,
      data
    }: {
      workspaceId: string;
      data: {
        name: string;
        url_slug?: string;
        short_code?: string;
        color?: string;
        description?: string;
      };
    }) => orpcClient.workspaces.update({ params: { workspace: workspaceId }, body: data }),
    onSuccess: async (updatedWorkspace, variables) => {
      // Update the workspace detail cache
      queryClient.setQueryData(workspaceKeys.detail(variables.workspaceId), updatedWorkspace);
      // Invalidate workspace list to reflect changes
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
      // Workspace audit keys are slug-based, so slug changes require a broad invalidation.
      await queryClient.invalidateQueries({ queryKey: auditKeys.all });
      await invalidateAuditQueries(queryClient, updatedWorkspace.url_slug);
    }
  });
};

// Hook for deleting a workspace
export const useDeleteWorkspace = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workspaceId: string) =>
      orpcClient.workspaces.remove({ params: { workspace: workspaceId } }),
    onSuccess: () => {
      // Invalidate all workspace queries
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    }
  });
};
