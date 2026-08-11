import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PublicCatalogConfig } from '@arch-register/api-types/publicCatalogContract';
import { orpcClient } from '../lib/orpcClient';

export const publicCatalogConfigKeys = {
  all: ['public-catalog-config'] as const,
  workspace: (workspaceSlug: string) => [...publicCatalogConfigKeys.all, workspaceSlug] as const
};

export const usePublicCatalogConfig = (workspaceSlug: string, enabled = true) =>
  useQuery({
    queryKey: publicCatalogConfigKeys.workspace(workspaceSlug),
    queryFn: () => orpcClient.publicCatalogConfig.get({ params: { workspace: workspaceSlug } }),
    enabled: Boolean(workspaceSlug) && enabled,
    staleTime: 30_000
  });

export const useUpdatePublicCatalogConfig = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: PublicCatalogConfig) =>
      orpcClient.publicCatalogConfig.replace({
        params: { workspace: workspaceSlug },
        body: config
      }),
    onSuccess: value => {
      queryClient.setQueryData(publicCatalogConfigKeys.workspace(workspaceSlug), value);
    }
  });
};
