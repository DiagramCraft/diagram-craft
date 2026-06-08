import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { WorkspaceAiConfig, UpsertAiConfigRequest } from '@arch-register/api-types';

export const aiConfigKeys = {
  all: ['ai-config'] as const,
  detail: (ws: string) => [...aiConfigKeys.all, ws] as const
};

export const useAiConfig = (workspaceSlug: string, enabled = true) => {
  return useQuery({
    queryKey: aiConfigKeys.detail(workspaceSlug),
    queryFn: () => apiFetch<WorkspaceAiConfig>(`/api/${workspaceSlug}/ai/config`),
    enabled: enabled && !!workspaceSlug,
    staleTime: 60_000
  });
};

export const useUpdateAiConfig = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertAiConfigRequest) =>
      apiFetch<WorkspaceAiConfig>(`/api/${workspaceSlug}/ai/config`, {
        method: 'PUT',
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiConfigKeys.detail(workspaceSlug) });
    }
  });
};
