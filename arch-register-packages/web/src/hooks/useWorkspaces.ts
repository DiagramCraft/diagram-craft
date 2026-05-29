import { useQuery } from '@tanstack/react-query';
import type { Workspace } from '../api';
import { apiFetch } from '../api';

export const useWorkspaces = () => {
  return useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      return await apiFetch<Workspace[]>('/api/workspaces');
    },
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
};
