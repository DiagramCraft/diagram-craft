import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateSavedViewRequest,
  UpdateSavedViewRequest
} from '@arch-register/api-types/viewContract';
import { invalidateSavedViewQueries, viewKeys } from '../queries/views';
import { orpcClient } from '../lib/orpcClient';

export const useSavedViews = (
  workspaceId: string,
  options?: { projectId?: string; includeWorkspace?: boolean }
) =>
  useQuery({
    queryKey: viewKeys.list(workspaceId, options),
    queryFn: () =>
      orpcClient.views.list({
        params: { workspace: workspaceId },
        query: { projectId: options?.projectId, includeWorkspace: options?.includeWorkspace }
      }),
    enabled: !!workspaceId
  });

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
