import type { QueryClient } from '@tanstack/react-query';
import { invalidateAuditQueries } from './audit';

export const changeCaseKeys = {
  all: ['changeCases'] as const,
  byProject: (workspaceId: string, projectId: string) =>
    [...changeCaseKeys.all, 'by-project', workspaceId, projectId] as const,
  detail: (workspaceId: string, caseId: string) =>
    [...changeCaseKeys.all, 'detail', workspaceId, caseId] as const,
  applyConflicts: (workspaceId: string, caseId: string) =>
    [...changeCaseKeys.all, 'apply-conflicts', workspaceId, caseId] as const
};

export const invalidateChangeCaseQueries = async (
  queryClient: QueryClient,
  workspaceId: string,
  projectId: string,
  caseId?: string
) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: changeCaseKeys.byProject(workspaceId, projectId) }),
    invalidateAuditQueries(queryClient, workspaceId),
    ...(caseId
      ? [
          queryClient.invalidateQueries({ queryKey: changeCaseKeys.detail(workspaceId, caseId) }),
          queryClient.invalidateQueries({
            queryKey: changeCaseKeys.applyConflicts(workspaceId, caseId)
          })
        ]
      : [])
  ]);
};
