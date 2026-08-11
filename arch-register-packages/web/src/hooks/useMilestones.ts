import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateMilestoneQueries, milestonesQuery } from '../queries/milestones';
import type {
  CreateMilestoneRequest,
  UpdateMilestoneRequest
} from '@arch-register/api-types/milestoneContract';
import { orpcClient } from '../lib/orpcClient';

export const useMilestones = (workspaceId: string, projectId?: string, enabled = true) => {
  return useQuery(milestonesQuery(workspaceId, projectId, enabled));
};

export const useCreateMilestone = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: Omit<CreateMilestoneRequest, 'project_id'>) =>
      orpcClient.milestones.create({
        params: { workspace: workspaceId },
        body: { ...body, project_id: projectId }
      }),
    onSuccess: async () => invalidateMilestoneQueries(queryClient, workspaceId)
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
    onSuccess: async (_, variables) =>
      invalidateMilestoneQueries(queryClient, workspaceId, variables.milestoneId)
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
    onSuccess: async () => invalidateMilestoneQueries(queryClient, workspaceId)
  });
};
