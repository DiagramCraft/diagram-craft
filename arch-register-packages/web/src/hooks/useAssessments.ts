import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { assessmentKeys } from '../queries/assessments';
import { invalidateAuditQueries } from '../queries/audit';
import type {
  Assessment,
  CreateAssessmentRequest,
  UpdateAssessmentRequest
} from '@arch-register/api-types/assessmentContract';
import { orpcClient } from '../lib/orpcClient';
import { useProject } from './useProjects';

export const useAssessments = (workspaceId: string, enabled = true) =>
  useQuery({
    queryKey: assessmentKeys.list(workspaceId),
    queryFn: () => orpcClient.assessments.list({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId
  });

export const useProjectAssessments = (workspaceId: string, projectId: string) => {
  const projectQuery = useProject(workspaceId, projectId);
  const assessmentsQuery = useAssessments(workspaceId, projectQuery.data != null);
  return {
    ...assessmentsQuery,
    data: assessmentsQuery.data?.filter(
      assessment => assessment.project_id === projectQuery.data?.id
    )
  };
};

export const useCreateAssessment = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: Omit<CreateAssessmentRequest, 'project_id'>) =>
      orpcClient.assessments.create({
        params: { workspace: workspaceId },
        body: { ...body, project_id: projectId }
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: assessmentKeys.list(workspaceId) });
      await invalidateAuditQueries(queryClient, workspaceId);
    }
  });
};

export const useUpdateAssessment = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      assessmentId,
      data
    }: {
      assessmentId: string;
      data: Omit<UpdateAssessmentRequest, 'project_id'>;
    }) =>
      orpcClient.assessments.update({
        params: { workspace: workspaceId, assessmentId },
        body: { ...data, project_id: projectId }
      }),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: assessmentKeys.detail(workspaceId, variables.assessmentId)
      });
      await queryClient.invalidateQueries({ queryKey: assessmentKeys.list(workspaceId) });
      await invalidateAuditQueries(queryClient, workspaceId);
    }
  });
};

export const useUpdateAssessmentStatus = (workspaceId: string, _projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      assessmentId,
      status
    }: {
      assessmentId: string;
      status: Assessment['status'];
    }) =>
      orpcClient.assessments.updateStatus({
        params: { workspace: workspaceId, assessmentId },
        body: { status }
      }),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: assessmentKeys.detail(workspaceId, variables.assessmentId)
      });
      await queryClient.invalidateQueries({ queryKey: assessmentKeys.list(workspaceId) });
      await invalidateAuditQueries(queryClient, workspaceId);
    }
  });
};

export const useDeleteAssessment = (workspaceId: string, _projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (assessmentId: string) =>
      orpcClient.assessments.remove({ params: { workspace: workspaceId, assessmentId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: assessmentKeys.list(workspaceId) });
      await invalidateAuditQueries(queryClient, workspaceId);
    }
  });
};
