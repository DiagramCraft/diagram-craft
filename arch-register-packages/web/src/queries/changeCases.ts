import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { invalidateAuditQueries } from './audit';
import { orpcClient } from '../lib/orpcClient';

export const changeCaseKeys = {
  all: ['changeCases'] as const,
  byProject: (workspaceId: string, projectId: string) =>
    [...changeCaseKeys.all, 'by-project', workspaceId, projectId] as const,
  byEntity: (workspaceId: string, entityId: string) =>
    [...changeCaseKeys.all, 'by-entity', workspaceId, entityId] as const,
  detail: (workspaceId: string, caseId: string) =>
    [...changeCaseKeys.all, 'detail', workspaceId, caseId] as const,
  applyConflicts: (workspaceId: string, caseId: string) =>
    [...changeCaseKeys.all, 'apply-conflicts', workspaceId, caseId] as const
};

export const changeCasesByProjectQuery = (workspaceId: string, projectId: string, enabled = true) =>
  queryOptions({
    queryKey: changeCaseKeys.byProject(workspaceId, projectId),
    queryFn: () =>
      orpcClient.changeCases.listByProject({ params: { workspace: workspaceId, id: projectId } }),
    enabled: enabled && !!workspaceId && !!projectId
  });

export const changeCasesByEntityQuery = (workspaceId: string, entityId: string, enabled = true) =>
  queryOptions({
    queryKey: changeCaseKeys.byEntity(workspaceId, entityId),
    queryFn: () =>
      orpcClient.changeCases.listByEntity({ params: { workspace: workspaceId, id: entityId } }),
    enabled: enabled && !!workspaceId && !!entityId
  });

export const changeCaseQuery = (
  workspaceId: string,
  projectId: string,
  caseId: string,
  enabled = true
) =>
  queryOptions({
    queryKey: changeCaseKeys.detail(workspaceId, caseId),
    queryFn: () =>
      orpcClient.changeCases.get({
        params: { workspace: workspaceId, id: projectId, caseId }
      }),
    enabled: enabled && !!workspaceId && !!projectId && !!caseId
  });

export const changeCaseApplyConflictsQuery = (
  workspaceId: string,
  projectId: string,
  caseId: string,
  enabled = true
) =>
  queryOptions({
    queryKey: changeCaseKeys.applyConflicts(workspaceId, caseId),
    queryFn: () =>
      orpcClient.changeCases.checkApplyConflicts({
        params: { workspace: workspaceId, id: projectId, caseId }
      }),
    enabled: enabled && !!workspaceId && !!projectId && !!caseId
  });

export const invalidateChangeCaseQueries = async (
  queryClient: QueryClient,
  workspaceId: string,
  projectId: string,
  caseId?: string,
  entityId?: string
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
      : []),
    ...(entityId
      ? [
          queryClient.invalidateQueries({
            queryKey: changeCaseKeys.byEntity(workspaceId, entityId)
          })
        ]
      : [])
  ]);
};
