import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { milestoneKeys } from '../queries/milestones';
import { invalidateAuditQueries } from '../queries/audit';
import type {
  CreateMilestoneRequest,
  UpdateMilestoneRequest
} from '@arch-register/api-types/milestoneContract';
import { orpcClient } from '../lib/orpcClient';

export const useMilestones = (workspaceId: string, projectId?: string, enabled = true) => {
  return useQuery({
    queryKey: milestoneKeys.list(workspaceId, projectId),
    queryFn: async () =>
      await orpcClient.milestones.list({
        params: { workspace: workspaceId },
        query: { project_id: projectId }
      }),
    enabled: enabled && !!workspaceId
  });
};

export const useCreateMilestone = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: Omit<CreateMilestoneRequest, 'project_id'>) =>
      orpcClient.milestones.create({
        params: { workspace: workspaceId },
        body: { ...body, project_id: projectId }
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: milestoneKeys.list(workspaceId)
      });
      await invalidateAuditQueries(queryClient, workspaceId);
    }
  });
};

export const useUpdateMilestone = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      milestoneId,
      data
    }: {
      milestoneId: string;
      data: Omit<UpdateMilestoneRequest, 'project_id'>;
    }) =>
      orpcClient.milestones.update({
        params: { workspace: workspaceId, milestoneId },
        body: { ...data, project_id: projectId }
      }),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: milestoneKeys.detail(workspaceId, variables.milestoneId)
      });
      await queryClient.invalidateQueries({
        queryKey: milestoneKeys.list(workspaceId)
      });
      await invalidateAuditQueries(queryClient, workspaceId);
    }
  });
};

export const useDeleteMilestone = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();
  void projectId;

  return useMutation({
    mutationFn: (milestoneId: string) =>
      orpcClient.milestones.remove({
        params: { workspace: workspaceId, milestoneId }
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: milestoneKeys.list(workspaceId)
      });
      await invalidateAuditQueries(queryClient, workspaceId);
    }
  });
};
