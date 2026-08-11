import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import { invalidateGlobalUserQueries } from '../queries/globalRoles';
import { invalidateAllWorkspaceMembers } from '../queries/workspaceMembers';

export const useUpdateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      updates
    }: {
      userId: string;
      updates: { color?: string | null; display_name?: string };
    }) => {
      return orpcClient.authProtected.updateUser({
        params: { id: userId },
        body: updates
      });
    },
    onSuccess: () => {
      void Promise.all([
        invalidateGlobalUserQueries(queryClient),
        invalidateAllWorkspaceMembers(queryClient)
      ]);
    }
  });
};
