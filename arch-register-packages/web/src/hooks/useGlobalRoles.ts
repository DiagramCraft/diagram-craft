import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import type { GlobalRole } from '@arch-register/permissions';

type GlobalRoleAssignment = {
  user_id: string;
  role: GlobalRole;
  created_at?: string;
};

export const globalRolesKeys = {
  users: ['auth-users'] as const,
  roles: (userId: string) => ['auth-users', userId, 'global-roles'] as const
};

export const useAuthUsers = (enabled = true) =>
  useQuery({
    queryKey: globalRolesKeys.users,
    queryFn: () => orpcClient.authProtected.listUsers(),
    enabled,
    staleTime: 60 * 1000
  });

export const useUserGlobalRoles = (userId: string, enabled = true) =>
  useQuery({
    queryKey: globalRolesKeys.roles(userId),
    queryFn: () => orpcClient.authProtected.getGlobalRoles({ params: { id: userId } }),
    enabled: enabled && !!userId,
    staleTime: 60 * 1000
  });

export const useUpdateUserGlobalRoles = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, roles }: { userId: string; roles: GlobalRole[] }) =>
      orpcClient.authProtected.replaceGlobalRoles({
        params: { id: userId },
        body: { roles }
      }),
    onSuccess: (data: GlobalRoleAssignment[], variables) => {
      queryClient.setQueryData(globalRolesKeys.roles(variables.userId), data);
    }
  });
};
