import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SchemaField } from '@arch-register/api-types/schemaContract';
import { orpcClient } from '../lib/orpcClient';
import { fieldGroupKeys, invalidateDeletedFieldGroup } from '../queries/fieldGroups';

export const useFieldGroups = (workspaceSlug: string, enabled = true) =>
  useQuery({
    queryKey: fieldGroupKeys.list(workspaceSlug),
    queryFn: () => orpcClient.fieldGroups.list({ params: { workspace: workspaceSlug } }),
    enabled: enabled && !!workspaceSlug,
    staleTime: 5 * 60 * 1000
  });

export const useCreateFieldGroup = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string; fields?: SchemaField[] }) =>
      orpcClient.fieldGroups.create({ params: { workspace: workspaceSlug }, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: fieldGroupKeys.list(workspaceSlug) })
  });
};

export const useUpdateFieldGroup = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      fieldGroupId,
      data
    }: {
      fieldGroupId: string;
      data: {
        name: string;
        description?: string;
        fields: SchemaField[];
        fieldMigrations?: Record<
          string,
          { action: 'rename' | 'remove' | 'archive'; renameTo?: string }
        >;
      };
    }) =>
      orpcClient.fieldGroups.update({
        params: { workspace: workspaceSlug, id: fieldGroupId },
        body: data
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: fieldGroupKeys.list(workspaceSlug) });
      queryClient.invalidateQueries({
        queryKey: fieldGroupKeys.detail(workspaceSlug, variables.fieldGroupId)
      });
      queryClient.invalidateQueries({ queryKey: ['schemas', 'list', workspaceSlug] });
    }
  });
};

export const useDeleteFieldGroup = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fieldGroupId: string) =>
      orpcClient.fieldGroups.remove({ params: { workspace: workspaceSlug, id: fieldGroupId } }),
    onSuccess: (_, fieldGroupId) =>
      invalidateDeletedFieldGroup(queryClient, workspaceSlug, fieldGroupId)
  });
};
