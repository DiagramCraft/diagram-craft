import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { milestoneKeys } from '../queries/milestones';
import { invalidateAuditQueries } from '../queries/audit';
import type {
  CreateMilestoneRequest,
  UpdateMilestoneRequest
} from '@arch-register/api-types/milestoneContract';
import { orpcClient } from '../lib/orpcClient';

export const useMilestones = (workspaceId: string, projectId: string, enabled = true) => {
  return useQuery({
    queryKey: milestoneKeys.list(workspaceId, projectId),
    queryFn: async () =>
      await orpcClient.milestones.list({ params: { workspace: workspaceId, id: projectId } }),
    enabled: enabled && !!workspaceId && !!projectId
  });
};

export const useMilestonesForProjects = (workspaceId: string, projectIds: string[]) => {
  return useQueries({
    queries: projectIds.map(projectId => ({
      queryKey: milestoneKeys.list(workspaceId, projectId),
      queryFn: async () =>
        await orpcClient.milestones.list({ params: { workspace: workspaceId, id: projectId } }),
      enabled: !!workspaceId && !!projectId
    }))
  });
};

export const useCreateMilestone = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateMilestoneRequest) =>
      orpcClient.milestones.create({ params: { workspace: workspaceId, id: projectId }, body }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: milestoneKeys.list(workspaceId, projectId)
      });
      await invalidateAuditQueries(queryClient, workspaceId);
    }
  });
};

export const useUpdateMilestone = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ milestoneId, data }: { milestoneId: string; data: UpdateMilestoneRequest }) =>
      orpcClient.milestones.update({
        params: { workspace: workspaceId, id: projectId, milestoneId },
        body: data
      }),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: milestoneKeys.detail(workspaceId, projectId, variables.milestoneId)
      });
      await queryClient.invalidateQueries({
        queryKey: milestoneKeys.list(workspaceId, projectId)
      });
      await invalidateAuditQueries(queryClient, workspaceId);
    }
  });
};

export const useDeleteMilestone = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (milestoneId: string) =>
      orpcClient.milestones.remove({
        params: { workspace: workspaceId, id: projectId, milestoneId }
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: milestoneKeys.list(workspaceId, projectId)
      });
      await invalidateAuditQueries(queryClient, workspaceId);
    }
  });
};
