import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type {
  MarkdownContent,
  MarkdownRevisionDetail,
  MarkdownRevisionSummary
} from '@arch-register/api-types/projectMarkdownContract';
import { orpcClient } from '../lib/orpcClient';
import { invalidateContentScope, type ContentScope } from './content';

export const markdownContentKeys = {
  all: (workspaceId: string) => ['markdown-content', workspaceId] as const,
  detail: (workspaceId: string, nodeId: string) =>
    [...markdownContentKeys.all(workspaceId), nodeId] as const,
  revisions: (workspaceId: string, nodeId: string) =>
    [...markdownContentKeys.detail(workspaceId, nodeId), 'revisions'] as const,
  workflowHistory: (workspaceId: string, nodeId: string) =>
    [...markdownContentKeys.detail(workspaceId, nodeId), 'workflow-history'] as const,
  revision: (workspaceId: string, nodeId: string, revisionId: string) =>
    [...markdownContentKeys.revisions(workspaceId, nodeId), revisionId] as const
};

export const markdownContentQuery = (workspaceId: string, nodeId: string) =>
  queryOptions<MarkdownContent>({
    queryKey: markdownContentKeys.detail(workspaceId, nodeId),
    queryFn: () =>
      orpcClient.projects.getMarkdownContent({ params: { workspace: workspaceId, nodeId } }),
    enabled: !!workspaceId && !!nodeId
  });

export const markdownRevisionsQuery = (workspaceId: string, nodeId: string) =>
  queryOptions<MarkdownRevisionSummary[]>({
    queryKey: markdownContentKeys.revisions(workspaceId, nodeId),
    queryFn: () =>
      orpcClient.projects.listMarkdownRevisions({ params: { workspace: workspaceId, nodeId } }),
    enabled: !!workspaceId && !!nodeId
  });

export const markdownRevisionQuery = (
  workspaceId: string,
  nodeId: string,
  revisionId: string | undefined
) =>
  queryOptions<MarkdownRevisionDetail>({
    queryKey: markdownContentKeys.revision(workspaceId, nodeId, revisionId ?? ''),
    queryFn: () =>
      orpcClient.projects.getMarkdownRevision({
        params: { workspace: workspaceId, nodeId, revisionId: revisionId ?? '' }
      }),
    enabled: !!workspaceId && !!nodeId && !!revisionId
  });

export const markdownWorkflowHistoryQuery = (workspaceId: string, nodeId: string) =>
  queryOptions({
    queryKey: markdownContentKeys.workflowHistory(workspaceId, nodeId),
    queryFn: () =>
      orpcClient.projects.listMarkdownWorkflowHistory({
        params: { workspace: workspaceId, nodeId }
      }),
    enabled: !!workspaceId && !!nodeId
  });

export const invalidateMarkdownNode = async (
  queryClient: QueryClient,
  scope: ContentScope,
  nodeId: string
) => {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: markdownContentKeys.detail(scope.workspaceId, nodeId)
    }),
    queryClient.invalidateQueries({
      queryKey: markdownContentKeys.revisions(scope.workspaceId, nodeId)
    }),
    invalidateContentScope(queryClient, scope)
  ]);
};
