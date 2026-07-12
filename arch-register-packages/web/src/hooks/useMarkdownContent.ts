import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateAuditQueries, invalidateProjectQueries, entityContentKeys, workspaceContentKeys } from './queryKeys';
import {
  MarkdownContent,
  MarkdownRevisionDetail,
  MarkdownRevisionSummary
} from '@arch-register/api-types/projectContract';
import { orpcClient } from '../lib/orpcClient';
import { type ContentScope, invalidateScope } from './contentScope';

export const markdownContentKeys = {
  detail: (workspaceId: string, nodeId: string) => ['markdown-content', workspaceId, nodeId] as const,
  revisions: (workspaceId: string, nodeId: string) =>
    ['markdown-content', workspaceId, nodeId, 'revisions'] as const,
  revision: (workspaceId: string, nodeId: string, revisionId: string) =>
    ['markdown-content', workspaceId, nodeId, 'revisions', revisionId] as const
};

export const useMarkdownContent = (workspaceId: string, nodeId: string) => {
  return useQuery<MarkdownContent>({
    queryKey: markdownContentKeys.detail(workspaceId, nodeId),
    queryFn: () =>
      orpcClient.projects.getMarkdownContent({ params: { workspace: workspaceId, nodeId } }),
    enabled: !!workspaceId && !!nodeId
  });
};

// Refreshes markdown content/revisions plus whichever content area the node lives in.
const invalidateMarkdownNode = async (
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string,
  nodeId: string,
  options?: { projectId?: string; entityId?: string }
) => {
  await queryClient.invalidateQueries({ queryKey: markdownContentKeys.detail(workspaceId, nodeId) });
  await queryClient.invalidateQueries({ queryKey: markdownContentKeys.revisions(workspaceId, nodeId) });
  await invalidateAuditQueries(queryClient, workspaceId);

  if (options?.projectId) {
    await invalidateProjectQueries(queryClient, workspaceId, options.projectId);
    return;
  }

  if (options?.entityId) {
    await queryClient.invalidateQueries({ queryKey: entityContentKeys.all(workspaceId, options.entityId) });
    return;
  }

  await queryClient.invalidateQueries({ queryKey: workspaceContentKeys.all(workspaceId) });
};

export const useSaveMarkdownContent = (
  workspaceId: string,
  nodeId: string,
  options?: { projectId?: string; entityId?: string }
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, name }: { body: string; name?: string }) =>
      orpcClient.projects.saveMarkdownContent({
        params: { workspace: workspaceId, nodeId },
        body: { body, name }
      }),
    onSuccess: () => invalidateMarkdownNode(queryClient, workspaceId, nodeId, options)
  });
};

export const useMarkdownRevisions = (workspaceId: string, nodeId: string) => {
  return useQuery<MarkdownRevisionSummary[]>({
    queryKey: markdownContentKeys.revisions(workspaceId, nodeId),
    queryFn: () =>
      orpcClient.projects.listMarkdownRevisions({ params: { workspace: workspaceId, nodeId } }),
    enabled: !!workspaceId && !!nodeId
  });
};

export const useMarkdownRevision = (workspaceId: string, nodeId: string, revisionId: string | undefined) => {
  return useQuery<MarkdownRevisionDetail>({
    queryKey: markdownContentKeys.revision(workspaceId, nodeId, revisionId ?? ''),
    queryFn: () =>
      orpcClient.projects.getMarkdownRevision({
        params: { workspace: workspaceId, nodeId, revisionId: revisionId ?? '' }
      }),
    enabled: !!workspaceId && !!nodeId && !!revisionId
  });
};

export const useRestoreMarkdownRevision = (
  workspaceId: string,
  nodeId: string,
  options?: { projectId?: string; entityId?: string }
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (revisionId: string) =>
      orpcClient.projects.restoreMarkdownRevision({
        params: { workspace: workspaceId, nodeId, revisionId }
      }),
    onSuccess: () => invalidateMarkdownNode(queryClient, workspaceId, nodeId, options)
  });
};

const createMarkdown = (scope: ContentScope, name: string, folder?: string | null) => {
  const body = { name, ...(folder ? { folder } : {}) };
  switch (scope.kind) {
    case 'project':
      return orpcClient.projects.createProjectMarkdown({
        params: { workspace: scope.workspaceId, id: scope.projectId },
        body
      });
    case 'entity':
      return orpcClient.projects.createEntityMarkdown({
        params: { workspace: scope.workspaceId, entityId: scope.entityId },
        body
      });
    case 'workspace':
      return orpcClient.projects.createWorkspaceMarkdown({
        params: { workspace: scope.workspaceId },
        body
      });
  }
};

export const useCreateMarkdown = (scope: ContentScope) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, folder }: { name: string; folder?: string | null }) =>
      createMarkdown(scope, name, folder),
    onSuccess: () => invalidateScope(queryClient, scope)
  });
};
