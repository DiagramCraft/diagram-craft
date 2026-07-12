import { type QueryClient } from '@tanstack/react-query';
import { entityContentKeys, invalidateProjectQueries, workspaceContentKeys } from './queryKeys';

// Identifies which of the three parallel content areas (project files, entity content,
// workspace-root content) a file/folder operation targets. The backend exposes the same
// operations three times (deleteFile/deleteEntityFile/deleteWorkspaceFile, etc.) so hooks
// dispatch on `scope.kind` instead of being duplicated per scope.
export type ContentScope =
  | { kind: 'project'; workspaceId: string; projectId: string }
  | { kind: 'entity'; workspaceId: string; entityId: string }
  | { kind: 'workspace'; workspaceId: string };

export const invalidateScope = async (queryClient: QueryClient, scope: ContentScope) => {
  switch (scope.kind) {
    case 'project':
      return invalidateProjectQueries(queryClient, scope.workspaceId, scope.projectId);
    case 'entity':
      return queryClient.invalidateQueries({
        queryKey: entityContentKeys.all(scope.workspaceId, scope.entityId)
      });
    case 'workspace':
      return queryClient.invalidateQueries({
        queryKey: workspaceContentKeys.all(scope.workspaceId)
      });
  }
};

export const uploadUrl = (scope: ContentScope) => {
  switch (scope.kind) {
    case 'project':
      return `/api/${scope.workspaceId}/projects/${scope.projectId}/files/upload`;
    case 'entity':
      return `/api/${scope.workspaceId}/entities/${scope.entityId}/content/files/upload`;
    case 'workspace':
      return `/api/${scope.workspaceId}/content/files/upload`;
  }
};
