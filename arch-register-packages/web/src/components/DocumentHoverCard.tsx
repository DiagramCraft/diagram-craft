import type { ReactNode } from 'react';
import { useContentFile } from '../hooks/useContentScope';
import { useWorkspaceContext } from '../layouts/WorkspaceContext';
import { HoverCard } from './HoverCard';
import { DocumentHoverCardBody } from './DocumentHoverCardBody';

/**
 * Zero-config document hover card: fetches the file by id and renders the
 * default body. For contexts that already have the file data loaded, use
 * `HoverCard` + `DocumentHoverCardBody` directly instead to avoid a duplicate fetch.
 */
export const DocumentHoverCard = ({
  documentId,
  children
}: {
  documentId: string;
  children: ReactNode;
}) => {
  const { workspaceSlug } = useWorkspaceContext();
  const { data: document, isLoading, isError } = useContentFile(workspaceSlug, documentId);

  return (
    <HoverCard
      disabled={isLoading || isError || !document}
      content={
        document ? (
          <DocumentHoverCardBody
            name={document.name}
            path={document.path}
            commentCount={document.comment_count}
            unresolvedCommentCount={document.unresolved_comment_count}
          />
        ) : null
      }
    >
      {children}
    </HoverCard>
  );
};
