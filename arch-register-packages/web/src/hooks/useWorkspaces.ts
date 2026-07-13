import { queryOptions, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateAuditQueries } from '../queries/audit';
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
export const workspacesQueryOptions = () =>
  queryOptions({
    queryKey: workspaceKeys.list(),
    queryFn: () => orpcClient.workspaces.list({}),
    staleTime: 5 * 60 * 1000
  });

export const useWorkspaces = () => {
  return useQuery(workspacesQueryOptions());
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
      // Audit keys are slug-based, so refresh both sides of a slug rename.
      await invalidateAuditQueries(queryClient, variables.workspaceId);
      if (updatedWorkspace.url_slug !== variables.workspaceId) {
        await invalidateAuditQueries(queryClient, updatedWorkspace.url_slug);
      }
    }
  });
};

// Hook for deleting a workspace
export const useDeleteWorkspace = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workspaceId: string) =>
      orpcClient.workspaces.remove({ params: { workspace: workspaceId } }),
    onSuccess: (_, workspaceId) => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
      queryClient.removeQueries({ queryKey: workspaceKeys.detail(workspaceId) });
    }
  });
};
