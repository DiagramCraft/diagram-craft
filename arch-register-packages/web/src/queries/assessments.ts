import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { AssessmentField } from '@arch-register/api-types/assessmentContract';
import type { AssessmentResponse } from '@arch-register/api-types/assessmentResponseContract';
import {
  computeAssessmentStatus,
  type AssessmentMode
} from '@arch-register/api-types/assessmentStatus';
import { invalidateAuditQueries } from './audit';
import { orpcClient } from '../lib/orpcClient';

export const assessmentKeys = {
  all: ['assessments'] as const,
  lists: () => [...assessmentKeys.all, 'list'] as const,
  list: (workspaceId: string) => [...assessmentKeys.lists(), workspaceId] as const,
  details: () => [...assessmentKeys.all, 'detail'] as const,
  detail: (workspaceId: string, assessmentId: string) =>
    [...assessmentKeys.details(), workspaceId, assessmentId] as const
};

export const assessmentResponseKeys = {
  all: ['assessment-responses'] as const,
  lists: () => [...assessmentResponseKeys.all, 'list'] as const,
  list: (workspaceId: string, assessmentId: string) =>
    [...assessmentResponseKeys.lists(), workspaceId, assessmentId] as const
};

export const assessmentsQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: assessmentKeys.list(workspaceId),
    queryFn: () => orpcClient.assessments.list({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId
  });

export const assessmentResponsesQuery = (workspaceId: string, assessmentId: string) =>
  queryOptions({
    queryKey: assessmentResponseKeys.list(workspaceId, assessmentId),
    queryFn: () =>
      orpcClient.assessmentResponses.list({
        params: { workspace: workspaceId, assessmentId }
      }),
    enabled: !!workspaceId && !!assessmentId
  });

export const invalidateAssessmentQueries = async (
  queryClient: QueryClient,
  workspaceId: string,
  assessmentId?: string
) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: assessmentKeys.list(workspaceId) }),
    ...(assessmentId
      ? [
          queryClient.invalidateQueries({
            queryKey: assessmentKeys.detail(workspaceId, assessmentId)
          })
        ]
      : []),
    invalidateAuditQueries(queryClient, workspaceId)
  ]);
};

export const invalidateAssessmentResponseQueries = async (
  queryClient: QueryClient,
  workspaceId: string,
  assessmentId: string
) =>
  Promise.all([
    queryClient.invalidateQueries({
      queryKey: assessmentResponseKeys.list(workspaceId, assessmentId)
    }),
    invalidateAssessmentQueries(queryClient, workspaceId, assessmentId)
  ]);

type AssessmentUser = { id?: string | null; display_name?: string | null } | null | undefined;

export type AssessmentResponseCacheContext = { previous?: AssessmentResponse[] };

export const updateAssessmentResponseCache = async (
  queryClient: QueryClient,
  workspaceId: string,
  assessmentId: string,
  fields: AssessmentField[],
  mode: AssessmentMode,
  user: AssessmentUser,
  entityId: string,
  values: Record<string, string | number | boolean | null>
): Promise<AssessmentResponseCacheContext> => {
  const key = assessmentResponseKeys.list(workspaceId, assessmentId);
  await queryClient.cancelQueries({ queryKey: key });
  const previous = queryClient.getQueryData<AssessmentResponse[]>(key);
  queryClient.setQueryData<AssessmentResponse[]>(key, current => {
    const existing = current?.find(response => response.entity_id === entityId);
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
    const rest = (current ?? []).filter(response => response.entity_id !== entityId);
    return [...rest, nextEntry];
  });
  return { previous };
};

export const restoreAssessmentResponseCache = (
  queryClient: QueryClient,
  workspaceId: string,
  assessmentId: string,
  context: AssessmentResponseCacheContext | undefined
) => {
  if (context?.previous) {
    queryClient.setQueryData(
      assessmentResponseKeys.list(workspaceId, assessmentId),
      context.previous
    );
  }
};
