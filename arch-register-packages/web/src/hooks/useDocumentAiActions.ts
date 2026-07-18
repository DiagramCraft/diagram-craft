import { useMutation } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';

export const useRunDocumentAiAction = (workspaceSlug: string) => {
  return useMutation({
    mutationFn: ({ nodeId, actionId }: { nodeId: string; actionId: string }) =>
      orpcClient.projects.runDocumentAiAction({
        params: { workspace: workspaceSlug, nodeId, actionId }
      })
  });
};
