import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { WorkspaceEnum } from '../lib/api';
import { apiFetch } from '../lib/api';
import { createWorkspaceEnumORPC, listWorkspaceEnumsORPC } from '../lib/enumORPCClient';

export const enumKeys = {
  all: ['enums'] as const,
  lists: () => [...enumKeys.all, 'list'] as const,
  list: (workspaceId: string) => [...enumKeys.lists(), workspaceId] as const,
  details: () => [...enumKeys.all, 'detail'] as const,
  detail: (workspaceId: string, enumId: string) =>
    [...enumKeys.details(), workspaceId, enumId] as const
};

export const useEnums = (workspaceSlug: string, enabled = true) => {
  return useQuery({
    queryKey: enumKeys.list(workspaceSlug),
    queryFn: async () => await listWorkspaceEnumsORPC(workspaceSlug),
    enabled: enabled && !!workspaceSlug,
    staleTime: 5 * 60 * 1000
  });
};

export const useCreateEnum = (workspaceSlug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { name: string; options?: Array<{ value: string; label: string }> }) =>
      createWorkspaceEnumORPC(workspaceSlug, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: enumKeys.list(workspaceSlug) });
    }
  });
};

export const useUpdateEnum = (workspaceSlug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      enumId,
      data
    }: {
      enumId: string;
      data: { name: string; options: Array<{ value: string; label: string }> };
    }) =>
      apiFetch<WorkspaceEnum>(`/api/${workspaceSlug}/enums/${enumId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: enumKeys.detail(workspaceSlug, variables.enumId) });
      queryClient.invalidateQueries({ queryKey: enumKeys.list(workspaceSlug) });
    }
  });
};

export const useDeleteEnum = (workspaceSlug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (enumId: string) =>
      apiFetch<{ success: boolean }>(`/api/${workspaceSlug}/enums/${enumId}`, {
        method: 'DELETE'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: enumKeys.all });
    }
  });
};
