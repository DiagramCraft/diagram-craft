import type { QueryClient } from '@tanstack/react-query';
import { queryOptions } from '@tanstack/react-query';
import type { ProjectFile } from '@arch-register/api-types/projectContract';
import { orpcClient } from '../lib/orpcClient';
import { invalidateAuditQueries } from './audit';
import { projectEntityKeys, projectKeys } from './projectKeys';
import { invalidateWorkspaceSearches } from './search';

export type ContentScope =
  | { kind: 'project'; workspaceId: string; projectId: string }
  | { kind: 'entity'; workspaceId: string; entityId: string }
  | { kind: 'workspace'; workspaceId: string };

export const entityContentKeys = {
  all: (workspaceId: string, entityId: string) => ['entity-content', workspaceId, entityId] as const
};

export const workspaceContentKeys = {
  all: (workspaceId: string) => ['workspace-content', workspaceId] as const
};

export const projectFileKeys = {
  all: ['project-files'] as const,
  lists: () => [...projectFileKeys.all, 'list'] as const,
  workspaceLists: (workspaceId: string) => [...projectFileKeys.lists(), workspaceId] as const,
  list: (workspaceId: string, projectId: string) =>
    [...projectFileKeys.workspaceLists(workspaceId), projectId] as const,
  detail: (workspaceId: string, fileId: string) =>
    [...projectFileKeys.all, 'detail', workspaceId, fileId] as const,
  content: (workspaceId: string, fileId: string) =>
    [...projectFileKeys.all, 'content', workspaceId, fileId] as const
};

export const contentScopeReady = (scope: ContentScope) =>
  !!scope.workspaceId &&
  (scope.kind === 'workspace' || (scope.kind === 'project' ? !!scope.projectId : !!scope.entityId));

export const contentScopeKey = (scope: ContentScope) => {
  switch (scope.kind) {
    case 'project':
      return projectFileKeys.list(scope.workspaceId, scope.projectId);
    case 'entity':
      return entityContentKeys.all(scope.workspaceId, scope.entityId);
    case 'workspace':
      return workspaceContentKeys.all(scope.workspaceId);
  }
};

const listContent = (scope: ContentScope) => {
  switch (scope.kind) {
    case 'project':
      return orpcClient.projects.listFiles({
        params: { workspace: scope.workspaceId, id: scope.projectId }
      });
    case 'entity':
      return orpcClient.projects.listEntityFiles({
        params: { workspace: scope.workspaceId, entityId: scope.entityId }
      });
    case 'workspace':
      return orpcClient.projects.listWorkspaceFiles({ params: { workspace: scope.workspaceId } });
  }
};

export const contentFileQuery = (workspaceId: string, fileId: string) =>
  queryOptions({
    queryKey: projectFileKeys.detail(workspaceId, fileId),
    queryFn: () => orpcClient.projects.getFile({ params: { workspace: workspaceId, fileId } }),
    enabled: !!workspaceId && !!fileId,
    refetchOnMount: true
  });

export const contentFileContentQuery = (workspaceId: string, fileId: string) =>
  queryOptions({
    queryKey: projectFileKeys.content(workspaceId, fileId),
    queryFn: () =>
      orpcClient.projects.getDiagramContent({ params: { workspace: workspaceId, fileId } }),
    enabled: !!workspaceId && !!fileId,
    refetchOnMount: true
  });

export const contentScopeQuery = (scope: ContentScope, enabled = true) =>
  queryOptions({
    queryKey: contentScopeKey(scope),
    queryFn: () => listContent(scope),
    enabled: enabled && contentScopeReady(scope)
  });

export const invalidateContentScope = async (queryClient: QueryClient, scope: ContentScope) => {
  switch (scope.kind) {
    case 'project':
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: projectKeys.list(scope.workspaceId) }),
        queryClient.invalidateQueries({
          queryKey: projectKeys.detail(scope.workspaceId, scope.projectId)
        }),
        queryClient.invalidateQueries({
          queryKey: projectFileKeys.list(scope.workspaceId, scope.projectId)
        }),
        queryClient.invalidateQueries({
          queryKey: projectEntityKeys.all(scope.workspaceId, scope.projectId)
        }),
        invalidateAuditQueries(queryClient, scope.workspaceId)
      ]);
      return;
    case 'entity':
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: entityContentKeys.all(scope.workspaceId, scope.entityId)
        }),
        queryClient.invalidateQueries({
          queryKey: projectEntityKeys.entityDiagramFiles(scope.workspaceId, scope.entityId)
        }),
        invalidateAuditQueries(queryClient, scope.workspaceId)
      ]);
      return;
    case 'workspace':
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: workspaceContentKeys.all(scope.workspaceId) }),
        invalidateAuditQueries(queryClient, scope.workspaceId)
      ]);
  }
};

export const invalidateContentFile = async (
  queryClient: QueryClient,
  scope: ContentScope,
  fileId: string
) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: projectFileKeys.detail(scope.workspaceId, fileId) }),
    queryClient.invalidateQueries({ queryKey: projectFileKeys.content(scope.workspaceId, fileId) }),
    invalidateContentScope(queryClient, scope)
  ]);
};

export const invalidateContentFileQueries = (
  queryClient: QueryClient,
  workspaceId: string,
  fileId: string
) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: projectFileKeys.detail(workspaceId, fileId) }),
    queryClient.invalidateQueries({ queryKey: projectFileKeys.content(workspaceId, fileId) })
  ]);

export const refreshDiagramFileCaches = async (
  queryClient: QueryClient,
  input:
    | { kind: 'workspace'; workspaceId: string; fileId: string }
    | { kind: 'entity'; workspaceId: string; entityId: string; fileId: string }
    | { kind: 'project'; workspaceId: string; projectId: string; fileId: string }
) => {
  if (input.kind === 'project') {
    await Promise.all([
      queryClient.refetchQueries({
        queryKey: projectFileKeys.list(input.workspaceId, input.projectId)
      }),
      queryClient.refetchQueries({
        queryKey: projectKeys.detail(input.workspaceId, input.projectId)
      })
    ]);
  } else {
    await invalidateContentScope(queryClient, input);
  }
  await Promise.all([
    invalidateWorkspaceSearches(queryClient, input.workspaceId),
    invalidateContentFileQueries(queryClient, input.workspaceId, input.fileId)
  ]);
};

export type ContentFile = ProjectFile;
