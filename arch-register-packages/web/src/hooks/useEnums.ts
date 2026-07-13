import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import { enumKeys, invalidateDeletedEnum } from '../queries/enums';

export const useEnums = (workspaceSlug: string, enabled = true) => {
  return useQuery({
    queryKey: enumKeys.list(workspaceSlug),
    queryFn: async () => await orpcClient.enums.list({ params: { workspace: workspaceSlug } }),
    enabled: enabled && !!workspaceSlug,
    staleTime: 5 * 60 * 1000
  });
};

export const useCreateEnum = (workspaceSlug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { name: string; options?: Array<{ value: string; label: string }> }) =>
      orpcClient.enums.create({ params: { workspace: workspaceSlug }, body }),
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
    }) => orpcClient.enums.update({ params: { workspace: workspaceSlug, id: enumId }, body: data }),
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
      orpcClient.enums.remove({ params: { workspace: workspaceSlug, id: enumId } }),
    onSuccess: (_, enumId) => invalidateDeletedEnum(queryClient, workspaceSlug, enumId)
  });
};
