import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ExternalContentMount } from '@arch-register/api-types/externalContentContract';
import { orpcClient } from '../lib/orpcClient';
import { workspaceContentKeys } from '../queries/content';

export const externalContentKeys = {
  list: (workspaceId: string) => ['external-content-mounts', workspaceId] as const
};

export type CreateExternalContentMountInput = {
  source: { type: 'git'; url: string };
  scope: { type: 'workspace' };
  destination_path: string;
  source_path: string;
  interval_hours: number;
};

export type UpdateExternalContentMountInput = Omit<CreateExternalContentMountInput, 'scope'> & {
  id: string;
};

export const useExternalContentMounts = (workspaceId: string, enabled = true) =>
  useQuery<ExternalContentMount[]>({
    queryKey: externalContentKeys.list(workspaceId),
    queryFn: () => orpcClient.externalContent.list({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId
  });

export const useExternalContentOperations = (workspaceId: string) => {
  const queryClient = useQueryClient();
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: externalContentKeys.list(workspaceId) }),
      queryClient.invalidateQueries({ queryKey: workspaceContentKeys.all(workspaceId) })
    ]);
  };

  const create = useMutation({
    mutationFn: (body: CreateExternalContentMountInput) =>
      orpcClient.externalContent.create({ params: { workspace: workspaceId }, body }),
    onSuccess: invalidate
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }: UpdateExternalContentMountInput) =>
      orpcClient.externalContent.update({ params: { workspace: workspaceId, id }, body }),
    onSuccess: invalidate
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      orpcClient.externalContent.remove({ params: { workspace: workspaceId, id } }),
    onSuccess: invalidate
  });

  const sync = useMutation({
    mutationFn: (id: string) =>
      orpcClient.externalContent.sync({ params: { workspace: workspaceId, id } }),
    onSuccess: invalidate
  });

  return { create, update, remove, sync };
};
