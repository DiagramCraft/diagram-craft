import { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from '@tanstack/react-router';
import { findMarkdownFileByPath, markdownPageRef } from '../lib/contentPath';
import { useContentTree, type ContentScope } from './useContentScope';
import { useWorkspaceContext } from '../layouts/WorkspaceContext';
import {
  asEntityPublicId,
  asProjectPublicId,
  entityMarkdownRoute,
  projectMarkdownRoute,
  workspaceMarkdownRoute
} from '../routes/publicObjectRoutes';

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/**
 * Resolves the wiki route's splat (`standards/api-guide`, or a legacy node id) to a node id.
 * With `redirect`, id URLs are replaced by the canonical path URL once the scope tree is loaded.
 * `nodeId` is '' on draft routes (no splat) and while the scope tree is loading.
 */
export const useWikiNodeId = (options: { redirect?: boolean } = {}) => {
  const params = useParams({ strict: false });
  const navigate = useNavigate();
  const { workspaceSlug } = useWorkspaceContext();
  const { projectId, entityId } = params;
  const pathname = useLocation({ select: location => location.pathname });
  // `_splat` is shared with the folder routes, so only treat it as a page reference under /wiki/
  const splat = params._splat && pathname.includes('/wiki/') ? safeDecode(params._splat) : '';
  const isWiki = !!splat;

  const scope: ContentScope = projectId
    ? { kind: 'project', workspaceId: workspaceSlug, projectId }
    : entityId
      ? { kind: 'entity', workspaceId: workspaceSlug, entityId }
      : { kind: 'workspace', workspaceId: workspaceSlug };
  const { data: tree, isLoading } = useContentTree(scope, { enabled: isWiki });

  const byPath = tree && isWiki ? findMarkdownFileByPath(tree, splat) : undefined;
  const byId =
    tree && isWiki && !byPath
      ? [...tree.rootFiles, ...tree.folders.flatMap(folder => folder.files)].find(
          file => file.id === splat
        )
      : undefined;
  // Anything that is not a known path is treated as an id; the id endpoints are workspace-wide,
  // so this also covers pages outside the scope tree and a tree that failed to load
  const nodeId = byPath?.id ?? (isWiki && !isLoading ? splat : '');

  useEffect(() => {
    if (!options.redirect || !byId) return;
    const ref = markdownPageRef(byId);
    if (ref === splat) return;
    const route = projectId
      ? projectMarkdownRoute(workspaceSlug, asProjectPublicId(projectId), ref)
      : entityId
        ? entityMarkdownRoute(workspaceSlug, asEntityPublicId(entityId), ref)
        : workspaceMarkdownRoute(workspaceSlug, ref);
    // The three routes share one search schema, so keep the current search as is
    void navigate({ ...route, search: ((previous: object) => previous) as never, replace: true });
  }, [options.redirect, byId, splat, projectId, entityId, workspaceSlug, navigate]);

  return { nodeId, isWikiRoute: isWiki, isDraft: !isWiki, resolving: isWiki && !nodeId && isLoading };
};
