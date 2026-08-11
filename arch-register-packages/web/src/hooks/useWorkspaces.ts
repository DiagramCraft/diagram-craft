import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import {
  invalidateWorkspaceAfterUpdate,
  removeDeletedWorkspace,
  setWorkspaceDetailCache,
  workspaceKeys as workspaceKeysFromQueries,
  workspacesQuery
} from '../queries/workspaces';

export const workspaceKeys = workspaceKeysFromQueries;

export const workspacesQueryOptions = workspacesQuery;

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
      setWorkspaceDetailCache(queryClient, variables.workspaceId, updatedWorkspace);
      // Invalidate workspace list to reflect changes
      await invalidateWorkspaceAfterUpdate(
        queryClient,
        variables.workspaceId,
        updatedWorkspace.url_slug
      );
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
      void removeDeletedWorkspace(queryClient, workspaceId);
    }
  });
};
