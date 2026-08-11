import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateDashboardRequest,
  UpdateDashboardRequest
} from '@arch-register/api-types/dashboardContract';
import { invalidateDashboardQueries, workspaceDashboardsQuery } from '../queries/dashboard';
import {
  invalidatePersonalDashboardQueries,
  personalDashboardsQuery
} from '../queries/personalDashboard';
import { orpcClient } from '../lib/orpcClient';

export const useWorkspaceDashboards = (workspaceSlug: string) =>
  useQuery(workspaceDashboardsQuery(workspaceSlug));

export const useCreateWorkspaceDashboard = (workspaceSlug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateDashboardRequest) =>
      orpcClient.dashboards.create({ params: { workspace: workspaceSlug }, body }),
    onSuccess: () => invalidateDashboardQueries(queryClient, workspaceSlug)
  });
};

export const useUpdateWorkspaceDashboard = (workspaceSlug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateDashboardRequest }) =>
      orpcClient.dashboards.update({ params: { workspace: workspaceSlug, id }, body }),
    onSuccess: () => invalidateDashboardQueries(queryClient, workspaceSlug)
  });
};

export const useDeleteWorkspaceDashboard = (workspaceSlug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      orpcClient.dashboards.remove({ params: { workspace: workspaceSlug, id } }),
    onSuccess: () => invalidateDashboardQueries(queryClient, workspaceSlug)
  });
};

export const usePersonalDashboards = (workspaceSlug: string) =>
  useQuery(personalDashboardsQuery(workspaceSlug));

export const useCreatePersonalDashboard = (workspaceSlug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateDashboardRequest) =>
      orpcClient.personalDashboards.create({ params: { workspace: workspaceSlug }, body }),
    onSuccess: () => invalidatePersonalDashboardQueries(queryClient, workspaceSlug)
  });
};

export const useUpdatePersonalDashboard = (workspaceSlug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateDashboardRequest }) =>
      orpcClient.personalDashboards.update({ params: { workspace: workspaceSlug, id }, body }),
    onSuccess: () => invalidatePersonalDashboardQueries(queryClient, workspaceSlug)
  });
};

export const useDeletePersonalDashboard = (workspaceSlug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      orpcClient.personalDashboards.remove({ params: { workspace: workspaceSlug, id } }),
    onSuccess: () => invalidatePersonalDashboardQueries(queryClient, workspaceSlug)
  });
};
