import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import {
  externalContentKeys as externalContentKeysFromQueries,
  externalContentQuery,
  invalidateExternalContent
} from '../queries/externalContent';

export const externalContentKeys = externalContentKeysFromQueries;

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
  useQuery(externalContentQuery(workspaceId, enabled));

export const useExternalContentOperations = (workspaceId: string) => {
  const queryClient = useQueryClient();
  const invalidate = async () => invalidateExternalContent(queryClient, workspaceId);

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
