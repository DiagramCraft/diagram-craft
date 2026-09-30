import { queryOptions } from '@tanstack/react-query';
import { orpcClient } from '../../lib/orpcClient';

export const glossaryKeys = {
  all: ['glossary'] as const,
  config: (workspaceId: string) => [...glossaryKeys.all, 'config', workspaceId] as const
};

export const glossaryConfigQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: glossaryKeys.config(workspaceId),
    queryFn: () => orpcClient.glossary.config({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId,
    staleTime: 5 * 60 * 1000
  });
