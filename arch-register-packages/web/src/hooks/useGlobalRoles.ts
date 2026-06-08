import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAuthUsers,
  fetchUserGlobalRoles,
  updateUserGlobalRoles,
  type GlobalRoleAssignment
} from '../lib/api';
import type { GlobalRole } from '@arch-register/permissions';

export const globalRolesKeys = {
  users: ['auth-users'] as const,
  roles: (userId: string) => ['auth-users', userId, 'global-roles'] as const
};

export const useAuthUsers = (enabled = true) =>
  useQuery({
    queryKey: globalRolesKeys.users,
    queryFn: fetchAuthUsers,
    enabled,
    staleTime: 60 * 1000
  });

export const useUserGlobalRoles = (userId: string, enabled = true) =>
  useQuery({
    queryKey: globalRolesKeys.roles(userId),
    queryFn: () => fetchUserGlobalRoles(userId),
    enabled: enabled && !!userId,
    staleTime: 60 * 1000
  });

export const useUpdateUserGlobalRoles = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, roles }: { userId: string; roles: GlobalRole[] }) =>
      updateUserGlobalRoles(userId, roles),
    onSuccess: (data: GlobalRoleAssignment[], variables) => {
      queryClient.setQueryData(globalRolesKeys.roles(variables.userId), data);
    }
  });
};
