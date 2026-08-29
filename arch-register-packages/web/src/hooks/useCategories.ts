import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import { categoriesQuery, invalidateCategoryQueries } from '../queries/categories';

export const useCategories = (workspaceSlug: string, enabled = true) =>
  useQuery(categoriesQuery(workspaceSlug, enabled));

export const useCreateCategory = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      orpcClient.categories.create({ params: { workspace: workspaceSlug }, body: { name } }),
    onSuccess: () => invalidateCategoryQueries(queryClient, workspaceSlug)
  });
};

export const useUpdateCategory = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      orpcClient.categories.update({ params: { workspace: workspaceSlug, id }, body: { name } }),
    onSuccess: () => invalidateCategoryQueries(queryClient, workspaceSlug)
  });
};

export const useDeleteCategory = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      orpcClient.categories.remove({ params: { workspace: workspaceSlug, id } }),
    onSuccess: () => invalidateCategoryQueries(queryClient, workspaceSlug)
  });
};
