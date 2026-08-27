import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SchemaField } from '@arch-register/api-types/schemaContract';
import { orpcClient } from '../lib/orpcClient';
import {
  fieldGroupsQuery,
  invalidateDeletedFieldGroup,
  invalidateFieldGroupQueries
} from '../queries/fieldGroups';

export const useFieldGroups = (workspaceSlug: string, enabled = true) =>
  useQuery(fieldGroupsQuery(workspaceSlug, enabled));

export const useCreateFieldGroup = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      category?: string | null;
      description?: string;
      fields?: SchemaField[];
    }) => orpcClient.fieldGroups.create({ params: { workspace: workspaceSlug }, body }),
    onSuccess: () => invalidateFieldGroupQueries(queryClient, workspaceSlug)
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
        category?: string | null;
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
    onSuccess: (_, variables) =>
      invalidateFieldGroupQueries(queryClient, workspaceSlug, variables.fieldGroupId)
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
