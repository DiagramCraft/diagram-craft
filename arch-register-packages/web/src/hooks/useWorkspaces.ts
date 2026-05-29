import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api';
import type { Workspace } from '../api';

export const useWorkspaces = () => {
  return useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const workspaces = await apiFetch<Workspace[]>('/api/workspaces');
      return workspaces;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCreateWorkspace = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; url_slug: string; short_code: string; description: string }) => {
      const workspace = await apiFetch<Workspace>('/api/workspaces', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return workspace;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
};

export const useUpdateWorkspace = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Workspace> }) => {
      const workspace = await apiFetch<Workspace>(`/api/workspaces/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      return workspace;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
};

export const useDeleteWorkspace = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/api/workspaces/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
};
