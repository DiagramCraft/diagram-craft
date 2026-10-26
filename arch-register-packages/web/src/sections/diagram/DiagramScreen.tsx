import { useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearch, useRouter } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import '@diagram-craft/main/embed/embed.css';
import { refreshDiagramFileCaches } from '../../queries/content';
import { parentPath } from '../../lib/contentPath';
import {
  asEntityPublicId,
  asProjectPublicId,
  entityContentFolderRoute,
  entityDetailRoute,
  projectContentFolderRoute,
  projectDetailRoute,
  workspaceContentFolderRoute
} from '../../routes/publicObjectRoutes';
import { deriveDiagramScope } from './diagramScreenState';
import { DiagramScreenView } from './DiagramScreenView';
import { useDiagramDocument } from './useDiagramDocument';

// Edits one diagram file of a project, an entity or the workspace content, depending on the route.
export const DiagramScreen = () => {
  const params = useParams({ strict: false });
  // workspaceSlug/diagramId are always present: this screen only mounts under
  // the entity/project/content diagram routes, all of which define both params.
  const workspaceSlug = params.workspaceSlug!;
  const { diagramId, scope: derivedScope } = deriveDiagramScope(params);
  const scopeKey = JSON.stringify(derivedScope);
  // biome-ignore lint/correctness/useExhaustiveDependencies: scopeKey is derivedScope's content, so the scope keeps its identity until the route changes
  const scope = useMemo(() => derivedScope, [scopeKey]);

  const navigate = useNavigate();
  const router = useRouter();
  const search = useSearch({ strict: false });
  const queryClient = useQueryClient();
  const { loading, error, fileInfo, doc, dirty, setDirty, save } = useDiagramDocument({
    scope,
    diagramId,
    markdownSessionId: search.markdownSessionId
  });

  // Back to the content the diagram belongs to, in the diagram's folder when it is in one
  const navigateBack = useCallback(() => {
    const folder = fileInfo ? parentPath(fileInfo.path) : null;
    switch (scope.kind) {
      case 'workspace':
        return navigate(
          folder
            ? workspaceContentFolderRoute(workspaceSlug, folder)
            : { to: '/$workspaceSlug/content', params: { workspaceSlug } }
        );
      case 'entity': {
        const entityId = asEntityPublicId(scope.entityId);
        return navigate(
          folder
            ? entityContentFolderRoute(workspaceSlug, entityId, folder)
            : entityDetailRoute(workspaceSlug, entityId)
        );
      }
      case 'project': {
        const projectId = asProjectPublicId(scope.projectId);
        return navigate(
          folder
            ? projectContentFolderRoute(workspaceSlug, projectId, folder)
            : projectDetailRoute(workspaceSlug, projectId, {
                tab: 'projects' as const,
                section: 'home' as const
              })
        );
      }
    }
  }, [fileInfo, scope, navigate, workspaceSlug]);

  const handleClose = useCallback(async () => {
    await save();
    await refreshDiagramFileCaches(queryClient, { ...scope, fileId: diagramId });

    if (search.returnTo) {
      router.history.push(search.returnTo);
      return;
    }
    navigateBack();
  }, [save, queryClient, scope, diagramId, search.returnTo, router, navigateBack]);

  return (
    <DiagramScreenView
      workspaceId={scope.workspaceId}
      loading={loading}
      error={error}
      fileInfo={fileInfo}
      doc={doc}
      dirty={dirty}
      onDirtyChange={setDirty}
      onClose={handleClose}
    />
  );
};
