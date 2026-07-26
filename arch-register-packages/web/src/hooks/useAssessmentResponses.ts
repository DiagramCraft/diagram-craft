import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assessmentResponseKeys, assessmentKeys } from '../queries/assessments';
import { invalidateAuditQueries } from '../queries/audit';
import type { AssessmentField } from '@arch-register/api-types/assessmentContract';
import type { AssessmentResponse } from '@arch-register/api-types/assessmentResponseContract';
import {
  computeAssessmentStatus,
  type AssessmentMode
} from '@arch-register/api-types/assessmentStatus';
import { orpcClient } from '../lib/orpcClient';
import { useAuth } from '../auth/AuthContext';

export const useAssessmentResponses = (workspaceId: string, assessmentId: string) => {
  return useQuery({
    queryKey: assessmentResponseKeys.list(workspaceId, assessmentId),
    queryFn: async () =>
      await orpcClient.assessmentResponses.list({
        params: { workspace: workspaceId, assessmentId }
      }),
    enabled: !!workspaceId && !!assessmentId
  });
};

export const useUpsertAssessmentResponse = (
  workspaceId: string,
  assessmentId: string,
  fields: AssessmentField[],
  mode: AssessmentMode
) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const listKey = assessmentResponseKeys.list(workspaceId, assessmentId);

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
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<AssessmentResponse[]>(listKey);

      queryClient.setQueryData<AssessmentResponse[]>(listKey, current => {
        const existing = current?.find(r => r.entity_id === entityId);
        const mergedValues: Record<string, string | number | boolean> = {
          ...(existing?.values ?? {})
        };
        for (const [fieldId, value] of Object.entries(values)) {
          if (value === null) delete mergedValues[fieldId];
          else mergedValues[fieldId] = value;
        }
        const nextEntry: AssessmentResponse = {
          id: existing?.id ?? entityId,
          entity_id: entityId,
          values: mergedValues,
          status: computeAssessmentStatus(fields, mergedValues, mode),
          updated_at: new Date().toISOString(),
          updated_by: user?.id ?? existing?.updated_by ?? null,
          updated_by_name: user?.display_name ?? existing?.updated_by_name ?? null
        };
        const rest = (current ?? []).filter(r => r.entity_id !== entityId);
        return [...rest, nextEntry];
      });

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(listKey, context.previous);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: listKey });
      await queryClient.invalidateQueries({
        queryKey: assessmentKeys.list(workspaceId)
      });
      await queryClient.invalidateQueries({
        queryKey: assessmentKeys.detail(workspaceId, assessmentId)
      });
      await invalidateAuditQueries(queryClient, workspaceId);
    }
  });
};
