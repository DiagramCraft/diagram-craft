import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  assessmentResponsesQuery,
  invalidateAssessmentResponseQueries,
  restoreAssessmentResponseCache,
  updateAssessmentResponseCache
} from '../queries/assessments';
import type { AssessmentField } from '@arch-register/api-types/assessmentContract';
import type { AssessmentMode } from '@arch-register/api-types/assessmentStatus';
import { orpcClient } from '../lib/orpcClient';
import { useAuth } from '../auth/AuthContext';

export const useAssessmentResponses = (workspaceId: string, assessmentId: string) => {
  return useQuery(assessmentResponsesQuery(workspaceId, assessmentId));
};

export const useUpsertAssessmentResponse = (
  workspaceId: string,
  assessmentId: string,
  fields: AssessmentField[],
  mode: AssessmentMode
) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({
      entityId,
      values
    }: {
      entityId: string;
      values: Record<string, string | number | boolean | null>;
    }) =>
      orpcClient.assessmentResponses.upsert({
        params: { workspace: workspaceId, assessmentId, entityId },
        body: { values }
      }),
    onMutate: async ({ entityId, values }) => {
      return updateAssessmentResponseCache(
        queryClient,
        workspaceId,
        assessmentId,
        fields,
        mode,
        user,
        entityId,
        values
      );
    },
    onError: (_error, _variables, context) => {
      restoreAssessmentResponseCache(queryClient, workspaceId, assessmentId, context);
    },
    onSettled: async () => {
      await invalidateAssessmentResponseQueries(queryClient, workspaceId, assessmentId);
    }
  });
};
