import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import type { GlobalRole } from '@arch-register/permissions';
import {
  authUsersQuery,
  globalRolesKeys as globalRolesKeysFromQueries,
  setGlobalRolesCache,
  userGlobalRolesQuery,
  type GlobalRoleAssignment
} from '../queries/globalRoles';

export const globalRolesKeys = globalRolesKeysFromQueries;

export const useAuthUsers = (enabled = true) => useQuery(authUsersQuery(enabled));

export const useUserGlobalRoles = (userId: string, enabled = true) =>
  useQuery(userGlobalRolesQuery(userId, enabled));

export const useUpdateUserGlobalRoles = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, roles }: { userId: string; roles: GlobalRole[] }) =>
      orpcClient.authProtected.replaceGlobalRoles({
        params: { id: userId },
        body: { roles }
      }),
    onSuccess: (data: GlobalRoleAssignment[], variables) => {
      setGlobalRolesCache(queryClient, variables.userId, data);
    }
  });
};
