import { Link } from '@tanstack/react-router';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useContentFile } from '../../../hooks/useContentScope';
import { HoverCard } from '../../../components/HoverCard';
import { DocumentHoverCardBody } from '../../../components/DocumentHoverCardBody';
import { markdownFileRoute } from '../../../routes/publicObjectRoutes';
import styles from './WikiLink.module.css';

export const WikiLink = ({ id }: { id: string }) => {
  const { workspaceSlug } = useWorkspaceContext();
  const { data: file, isLoading, isError } = useContentFile(workspaceSlug, id);

  if (!id) return null;

  if (isLoading) {
    return <span className={styles.linkLoading}>{id}</span>;
  }

  // Deleted (404) and unreadable (403) pages both end up here
  if (isError || !file || file.type !== 'markdown') {
    return (
      <span className={styles.linkUnavailable} title="This wiki page is deleted or unavailable">
        page unavailable
      </span>
    );
  }

  return (
    <HoverCard
      content={
        <DocumentHoverCardBody
          name={file.name}
          path={file.path}
          commentCount={file.comment_count}
          unresolvedCommentCount={file.unresolved_comment_count}
        />
      }
    >
      <Link {...markdownFileRoute(workspaceSlug, file)} className={styles.link}>
        {file.name}
      </Link>
    </HoverCard>
  );
};
