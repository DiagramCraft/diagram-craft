import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import { invalidateGlobalUserQueries } from '../queries/globalRoles';
import { invalidateAllWorkspaceMembers } from '../queries/workspaceMembers';
import type { UserDetail, UserSummary } from '@arch-register/api-types/authContract';

export type ManagedUserCreateInput = {
  user_id: string;
  email?: string | null;
  display_name: string;
  password: string;
  is_active?: boolean;
  color?: string | null;
};

export type ManagedUserUpdateInput = {
  email?: string | null;
  display_name?: string;
  password?: string;
  is_active?: boolean;
  color?: string | null;
};

const invalidateUserQueries = (queryClient: ReturnType<typeof useQueryClient>) =>
  Promise.all([
    invalidateGlobalUserQueries(queryClient),
    invalidateAllWorkspaceMembers(queryClient)
  ]);

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

export const useCreateManagedUser = () => {
  const queryClient = useQueryClient();

  return useMutation<UserDetail, Error, ManagedUserCreateInput>({
    mutationFn: body => orpcClient.authProtected.createUser({ body }),
    onSuccess: (user: UserDetail) => {
      void invalidateUserQueries(queryClient);
      queryClient.setQueryData<UserSummary[]>(['auth-users'], users => {
        if (!users) return users;
        return [...users, user];
      });
    }
  });
};

export const useUpdateManagedUser = () => {
  const queryClient = useQueryClient();

  return useMutation<UserDetail, Error, { userId: string; updates: ManagedUserUpdateInput }>({
    mutationFn: ({ userId, updates }) =>
      orpcClient.authProtected.updateManagedUser({
        params: { id: userId },
        body: updates
      }),
    onSuccess: () => {
      void invalidateUserQueries(queryClient);
    }
  });
};

export const useDeactivateManagedUser = () => {
  const queryClient = useQueryClient();

  return useMutation<UserDetail, Error, string>({
    mutationFn: userId => orpcClient.authProtected.deactivateUser({ params: { id: userId } }),
    onSuccess: () => {
      void invalidateUserQueries(queryClient);
    }
  });
};
