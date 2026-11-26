import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { useContentTree, type ContentScope } from '../../../hooks/useContentScope';
import {
  findContentFilePath,
  findMarkdownFileByPath,
  resolveRelativeContentPath
} from '../../../lib/contentPath';
import { markdownFileRoute } from '../../../routes/publicObjectRoutes';
import wikiLinkStyles from '../../../widgets/content-layout/wiki-link/WikiLink.module.css';
import { useMdxContext } from '../MdxContext';

type MarkdownLinkProps = { href: string; title?: string; children: ReactNode };

const RelativePageLink = ({
  href,
  title,
  children,
  scope,
  workspaceSlug,
  nodeId
}: MarkdownLinkProps & { scope: ContentScope; workspaceSlug: string; nodeId: string }) => {
  const { data: tree, isLoading } = useContentTree(scope);

  const currentPath = tree ? findContentFilePath(tree.rootFiles, tree.folders, nodeId) : null;
  const targetPath = currentPath ? resolveRelativeContentPath(currentPath, href) : null;

  if (!tree || !currentPath || !targetPath) {
    // Tree still loading, or not a link we can resolve: keep the link inert instead of a 404
    return isLoading ? (
      <span className={wikiLinkStyles.linkLoading}>{children}</span>
    ) : (
      <a href={href} title={title}>
        {children}
      </a>
    );
  }

  const target = findMarkdownFileByPath(tree, targetPath);
  if (!target) {
    return (
      <span
        className={wikiLinkStyles.linkUnavailable}
        title="This wiki page is deleted or unavailable"
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      {...markdownFileRoute(workspaceSlug, target)}
      className={wikiLinkStyles.link}
      title={title}
    >
      {children}
    </Link>
  );
};

/**
 * A link in rendered markdown. Relative links (`./page`, `../other/page`) are resolved against the
 * path of the page being shown and navigate within the app, since pages are routed by id rather
 * than by path. Everything else is a plain anchor.
 */
export const MarkdownLink = ({ href, title, children }: MarkdownLinkProps) => {
  const { workspaceSlug, projectId, entityId, nodeId } = useMdxContext();

  const isRelative = resolveRelativeContentPath('x', href) !== null;
  if (!isRelative || !workspaceSlug || !nodeId) {
    return (
      <a href={href} title={title}>
        {children}
      </a>
    );
  }

  const scope: ContentScope = projectId
    ? { kind: 'project', workspaceId: workspaceSlug, projectId }
    : entityId
      ? { kind: 'entity', workspaceId: workspaceSlug, entityId }
      : { kind: 'workspace', workspaceId: workspaceSlug };

  return (
    <RelativePageLink
      href={href}
      title={title}
      scope={scope}
      workspaceSlug={workspaceSlug}
      nodeId={nodeId}
    >
      {children}
    </RelativePageLink>
  );
};
