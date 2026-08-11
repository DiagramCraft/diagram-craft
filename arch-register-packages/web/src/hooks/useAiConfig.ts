import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UpsertAiConfigRequest } from '@arch-register/api-types/aiContract';
import { orpcClient } from '../lib/orpcClient';
import {
  aiConfigKeys as aiConfigKeysFromQueries,
  aiConfigQuery,
  aiStatusQuery,
  invalidateAiConfig
} from '../queries/ai';

export const aiConfigKeys = aiConfigKeysFromQueries;

export const useAiConfig = (workspaceSlug: string, enabled = true) => {
  return useQuery(aiConfigQuery(workspaceSlug, enabled));
};

// Unlike useAiConfig, this is available to any workspace viewer (not just admins) since it
// exposes only whether AI is usable, not configuration details.
export const useAiStatus = (workspaceSlug: string, enabled = true) => {
  return useQuery(aiStatusQuery(workspaceSlug, enabled));
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
      invalidateAiConfig(queryClient, workspaceSlug);
    }
  });
};
