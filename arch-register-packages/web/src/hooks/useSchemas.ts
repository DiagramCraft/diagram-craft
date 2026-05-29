import { useQuery } from '@tanstack/react-query';
import type { EntitySchema } from '../api';
import { apiFetch } from '../api';

export const useSchemas = (workspaceSlug: string, enabled = true) => {
  return useQuery({
    queryKey: ['workspaces', workspaceSlug, 'schemas'],
    queryFn: async () => {
      return await apiFetch<EntitySchema[]>(`/api/${workspaceSlug}/schemas`);
    },
    enabled: enabled && !!workspaceSlug,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
};
