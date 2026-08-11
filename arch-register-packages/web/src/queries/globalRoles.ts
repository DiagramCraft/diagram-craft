import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import type { GlobalRole } from '@arch-register/permissions';

export type GlobalRoleAssignment = {
  user_id: string;
  role: GlobalRole;
  created_at?: string;
};

export const globalRolesKeys = {
  all: ['auth-users'] as const,
  users: () => globalRolesKeys.all,
  roles: (userId: string) => [...globalRolesKeys.all, userId, 'global-roles'] as const
};

export const authUsersQuery = (enabled = true) =>
  queryOptions({
    queryKey: globalRolesKeys.users(),
    queryFn: () => orpcClient.authProtected.listUsers(),
    enabled,
    staleTime: 60 * 1000
  });

export const userGlobalRolesQuery = (userId: string, enabled = true) =>
  queryOptions({
    queryKey: globalRolesKeys.roles(userId),
    queryFn: () => orpcClient.authProtected.getGlobalRoles({ params: { id: userId } }),
    enabled: enabled && !!userId,
    staleTime: 60 * 1000
  });

export const setGlobalRolesCache = (
  queryClient: QueryClient,
  userId: string,
  data: GlobalRoleAssignment[]
) => queryClient.setQueryData(globalRolesKeys.roles(userId), data);

export const invalidateGlobalUserQueries = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: globalRolesKeys.users() });
