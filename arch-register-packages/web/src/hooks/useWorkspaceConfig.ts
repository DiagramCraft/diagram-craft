import { useQuery } from '@tanstack/react-query';
import { fetchLifecycleStates, fetchOwnerOptions } from '../api';

export const useLifecycleStates = (workspaceSlug: string, enabled = true) => {
  return useQuery({
    queryKey: ['workspaces', workspaceSlug, 'lifecycle-states'],
    queryFn: () => fetchLifecycleStates(workspaceSlug),
    enabled: enabled && !!workspaceSlug,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useOwnerOptions = (workspaceSlug: string, enabled = true) => {
  return useQuery({
    queryKey: ['workspaces', workspaceSlug, 'owner-options'],
    queryFn: () => fetchOwnerOptions(workspaceSlug),
    enabled: enabled && !!workspaceSlug,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

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
