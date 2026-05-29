import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchLifecycleStates,
  fetchOwnerOptions,
  updateLifecycleStates,
  updateOwnerOptions,
  type WorkspaceLifecycleState,
  type WorkspaceOwnerOption,
} from '../api';

// Query keys factory
export const workspaceConfigKeys = {
  all: ['workspace-config'] as const,
  lifecycleStates: (workspaceId: string) => [...workspaceConfigKeys.all, 'lifecycle-states', workspaceId] as const,
  ownerOptions: (workspaceId: string) => [...workspaceConfigKeys.all, 'owner-options', workspaceId] as const,
};

// Hook for fetching lifecycle states
export const useLifecycleStates = (workspaceSlug: string, enabled = true) => {
  return useQuery({
    queryKey: workspaceConfigKeys.lifecycleStates(workspaceSlug),
    queryFn: () => fetchLifecycleStates(workspaceSlug),
    enabled: enabled && !!workspaceSlug,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Hook for fetching owner options
export const useOwnerOptions = (workspaceSlug: string, enabled = true) => {
  return useQuery({
    queryKey: workspaceConfigKeys.ownerOptions(workspaceSlug),
    queryFn: () => fetchOwnerOptions(workspaceSlug),
    enabled: enabled && !!workspaceSlug,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Hook for updating lifecycle states
export const useUpdateLifecycleStates = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (states: WorkspaceLifecycleState[]) =>
      updateLifecycleStates(workspaceId, states),
    onSuccess: (updatedStates) => {
      // Update the cache with the new states
      queryClient.setQueryData(
        workspaceConfigKeys.lifecycleStates(workspaceId),
        updatedStates
      );
    },
  });
};

// Hook for updating owner options
export const useUpdateOwnerOptions = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (owners: WorkspaceOwnerOption[]) =>
      updateOwnerOptions(workspaceId, owners),
    onSuccess: (updatedOwners) => {
      // Update the cache with the new owners
      queryClient.setQueryData(
        workspaceConfigKeys.ownerOptions(workspaceId),
        updatedOwners
      );
    },
  });
};

// Combined hook for workspace config
export const useWorkspaceConfig = (workspaceSlug: string, enabled = true) => {
  const lifecycleStates = useLifecycleStates(workspaceSlug, enabled);
  const ownerOptions = useOwnerOptions(workspaceSlug, enabled);

  return {
    lifecycleStates: lifecycleStates.data ?? [],
    ownerOptions: ownerOptions.data ?? [],
    isLoading: lifecycleStates.isLoading || ownerOptions.isLoading,
    isError: lifecycleStates.isError || ownerOptions.isError,
  };
};