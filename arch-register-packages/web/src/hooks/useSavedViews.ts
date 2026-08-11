import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateSavedViewRequest,
  UpdateSavedViewRequest
} from '@arch-register/api-types/viewContract';
import { invalidateSavedViewQueries, savedViewsQuery } from '../queries/views';
import { orpcClient } from '../lib/orpcClient';

export const useSavedViews = (
  workspaceId: string,
  options?: { projectId?: string; includeWorkspace?: boolean; enabled?: boolean }
) => {
  const { enabled = true, ...queryOptions } = options ?? {};

  return useQuery(savedViewsQuery(workspaceId, queryOptions, enabled));
};

export const useCreateSavedView = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateSavedViewRequest) =>
      orpcClient.views.create({ params: { workspace: workspaceId }, body }),
    onSuccess: () => invalidateSavedViewQueries(queryClient, workspaceId)
  });
};

export const useUpdateSavedView = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateSavedViewRequest }) =>
      orpcClient.views.update({ params: { workspace: workspaceId, id }, body }),
    onSuccess: () => invalidateSavedViewQueries(queryClient, workspaceId)
  });
};

export const useDeleteSavedView = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => orpcClient.views.remove({ params: { workspace: workspaceId, id } }),
    onSuccess: () => invalidateSavedViewQueries(queryClient, workspaceId)
  });
};
