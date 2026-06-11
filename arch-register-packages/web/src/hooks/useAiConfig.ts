import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import type { UpsertAiConfigRequest } from '@arch-register/api-types/aiContract';

export const aiConfigKeys = {
  all: ['ai-config'] as const,
  detail: (ws: string) => [...aiConfigKeys.all, ws] as const
};

export const useAiConfig = (workspaceSlug: string, enabled = true) => {
  return useQuery({
    queryKey: aiConfigKeys.detail(workspaceSlug),
    queryFn: () => orpcClient.ai.getConfig({ params: { workspace: workspaceSlug } }),
    enabled: enabled && !!workspaceSlug,
    staleTime: 60_000
  });
};

export const useUpdateAiConfig = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertAiConfigRequest) =>
      orpcClient.ai.updateConfig({
        params: { workspace: workspaceSlug },
        body: data
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiConfigKeys.detail(workspaceSlug) });
    }
  });
};
