import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateSavedViewRequest,
  UpdateSavedViewRequest
} from '@arch-register/api-types/viewContract';
import { viewKeys } from './queryKeys';
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: viewKeys.lists() })
  });
};

export const useUpdateSavedView = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateSavedViewRequest }) =>
      orpcClient.views.update({ params: { workspace: workspaceId, id }, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: viewKeys.lists() })
  });
};

export const useDeleteSavedView = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => orpcClient.views.remove({ params: { workspace: workspaceId, id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: viewKeys.lists() })
  });
};
