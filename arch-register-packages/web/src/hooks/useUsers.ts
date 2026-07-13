import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import { workspaceMembersKeys } from './useWorkspaceMembers';
import { globalRolesKeys } from './useGlobalRoles';

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
      // Invalidate any user-related queries if needed
      queryClient.invalidateQueries({ queryKey: globalRolesKeys.users });
      queryClient.invalidateQueries({ queryKey: workspaceMembersKeys.all });
    }
  });
};
