import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { assessmentKeys } from '../queries/assessments';
import { invalidateAuditQueries } from '../queries/audit';
import type {
  Assessment,
  CreateAssessmentRequest,
  UpdateAssessmentRequest
} from '@arch-register/api-types/assessmentContract';
import { orpcClient } from '../lib/orpcClient';

export const useAssessments = (workspaceId: string, projectId: string, enabled = true) => {
  return useQuery({
    queryKey: assessmentKeys.list(workspaceId, projectId),
    queryFn: async () =>
      await orpcClient.assessments.list({ params: { workspace: workspaceId, id: projectId } }),
    enabled: enabled && !!workspaceId && !!projectId
  });
};

export const useAssessmentsForProjects = (workspaceId: string, projectIds: string[]) => {
  return useQueries({
    queries: projectIds.map(projectId => ({
      queryKey: assessmentKeys.list(workspaceId, projectId),
      queryFn: async () =>
        await orpcClient.assessments.list({ params: { workspace: workspaceId, id: projectId } }),
      enabled: !!workspaceId && !!projectId
    }))
  });
};

export const useCreateAssessment = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateAssessmentRequest) =>
      orpcClient.assessments.create({ params: { workspace: workspaceId, id: projectId }, body }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: assessmentKeys.list(workspaceId, projectId) });
      await invalidateAuditQueries(queryClient, workspaceId);
    }
  });
};

export const useUpdateAssessment = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ assessmentId, data }: { assessmentId: string; data: UpdateAssessmentRequest }) =>
      orpcClient.assessments.update({
        params: { workspace: workspaceId, id: projectId, assessmentId },
        body: data
      }),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: assessmentKeys.detail(workspaceId, projectId, variables.assessmentId)
      });
      await queryClient.invalidateQueries({ queryKey: assessmentKeys.list(workspaceId, projectId) });
      await invalidateAuditQueries(queryClient, workspaceId);
    }
  });
};

export const useUpdateAssessmentStatus = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ assessmentId, status }: { assessmentId: string; status: Assessment['status'] }) =>
      orpcClient.assessments.updateStatus({
        params: { workspace: workspaceId, id: projectId, assessmentId },
        body: { status }
      }),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: assessmentKeys.detail(workspaceId, projectId, variables.assessmentId)
      });
      await queryClient.invalidateQueries({ queryKey: assessmentKeys.list(workspaceId, projectId) });
      await invalidateAuditQueries(queryClient, workspaceId);
    }
  });
};

export const useDeleteAssessment = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (assessmentId: string) =>
      orpcClient.assessments.remove({ params: { workspace: workspaceId, id: projectId, assessmentId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: assessmentKeys.list(workspaceId, projectId) });
      await invalidateAuditQueries(queryClient, workspaceId);
    }
  });
};
