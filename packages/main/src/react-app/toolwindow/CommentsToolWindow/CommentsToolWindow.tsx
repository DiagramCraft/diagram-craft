import { useApplication, useDiagram } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { Comment } from '@diagram-craft/model/comment';
import { useCallback, useState } from 'react';
import {
  buildCommentThreads,
  type CommentThread,
  type GroupBy,
  groupThreadsByAuthor,
  groupThreadsByElement,
  type SortBy,
  filterThreadsByUserParticipation
} from './utils';
import { CommentsSortMenu } from './CommentsSortMenu';
import { CommentItem } from './CommentItem';
import styles from './CommentsToolWindow.module.css';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { ToolWindow } from '../ToolWindow';
import { Button } from '@diagram-craft/app-components/Button';
import { TbPlus } from 'react-icons/tb';
import { UserState } from '../../../UserState';

export const CommentsToolWindow = () => {
  const application = useApplication();
  const diagram = useDiagram();
  const redraw = useRedraw();
  const [sortBy, setSortBy] = useState<SortBy>('date-desc');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [hideResolved, setHideResolved] = useState<boolean>(false);

  useEventListener(diagram.commentManager, 'commentAdded', redraw);
  useEventListener(diagram.commentManager, 'commentUpdated', redraw);
  useEventListener(diagram.commentManager, 'commentRemoved', redraw);
  useEventListener(diagram.selection, 'add', redraw);
  useEventListener(diagram.selection, 'remove', redraw);

  const handleResolveComment = useCallback(
    (comment: Comment) => {
      if (comment.state === 'resolved') {
        comment.unresolve();
      } else {
        comment.resolve();
      }
      diagram.commentManager.updateComment(comment);
    },
    [diagram]
  );

  const formatDate = (date: Date) => {
    return (
      date.toLocaleDateString() +
      ' ' +
      date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );
  };

  // Compute comment threads on every render (will be fast since there aren't many comments)
  const allComments = diagram.commentManager.getAll();

  // Filter out resolved comments if hideResolved is true
  const filteredComments = hideResolved
    ? allComments.filter(comment => comment.state === 'unresolved')
    : allComments;

  // Sort root comments, but preserve chronological order for replies within threads
  const sortedComments = [...filteredComments].sort((a, b) => {
    if (sortBy === 'date-asc') {
      return a.date.getTime() - b.date.getTime();
    } else {
      return b.date.getTime() - a.date.getTime();
    }
  });

  // Build comment threads
  const allThreads = buildCommentThreads(sortedComments);

  // Filter to selected element when something is selected on the canvas
  const selectedIds = new Set(diagram.selection.elements.map(e => e.id));
  const commentThreads =
    selectedIds.size > 0
      ? allThreads.filter(
          t => t.root.type === 'element' && t.root.element != null && selectedIds.has(t.root.element.id)
        )
      : allThreads;

  // Sort threads by their root comment date
  commentThreads.sort((a, b) => {
    if (sortBy === 'date-asc') {
      return a.root.date.getTime() - b.root.date.getTime();
    } else {
      return b.root.date.getTime() - a.root.date.getTime();
    }
  });

  // Group threads if needed
  const groupedThreads =
    groupBy === 'none'
      ? [{ key: 'all', title: '', threads: commentThreads }]
      : groupBy === 'element'
        ? groupThreadsByElement(commentThreads)
        : groupThreadsByAuthor(commentThreads);

  // Get current user name for "My Threads" tab
  const currentUserName = UserState.get().awarenessState.name;

  // Filter threads for "My Threads" tab
  const myThreads = filterThreadsByUserParticipation(commentThreads, currentUserName);
  const myGroupedThreads =
    groupBy === 'none'
      ? [{ key: 'all', title: '', threads: myThreads }]
      : groupBy === 'element'
        ? groupThreadsByElement(myThreads)
        : groupThreadsByAuthor(myThreads);

  return (
    <ToolWindow.Root id={'comments'} defaultTab={'comments'}>
      <ToolWindow.Tab title={'Comments'} id={'comments'}>
        <ToolWindow.TabActions>
          <Button
            size="sm"
            variant={'icon-only'}
            onClick={() => application.actions.COMMENT_ADD!.execute()}
          >
            <TbPlus />
          </Button>
          <CommentsSortMenu
            sortBy={sortBy}
            groupBy={groupBy}
            hideResolved={hideResolved}
            onSortChange={setSortBy}
            onGroupChange={setGroupBy}
            onHideResolvedChange={setHideResolved}
          />
        </ToolWindow.TabActions>
        <ToolWindow.TabContent>
          <ToolWindowPanel mode={'headless'} id={'comments'} title={'Comments'}>
            <ThreadsContent
              threads={commentThreads}
              grouped={groupedThreads}
              onResolve={handleResolveComment}
              formatDate={formatDate}
            />
          </ToolWindowPanel>
        </ToolWindow.TabContent>
      </ToolWindow.Tab>
      <ToolWindow.Tab title={'My Threads'} id={'my-threads'}>
        <ToolWindow.TabActions>
          <Button
            size="sm"
            variant={'icon-only'}
            onClick={() => application.actions.COMMENT_ADD!.execute()}
          >
            <TbPlus />
          </Button>
          <CommentsSortMenu
            sortBy={sortBy}
            groupBy={groupBy}
            hideResolved={hideResolved}
            onSortChange={setSortBy}
            onGroupChange={setGroupBy}
            onHideResolvedChange={setHideResolved}
          />
        </ToolWindow.TabActions>
        <ToolWindow.TabContent>
          <ToolWindowPanel mode={'headless'} id={'my-threads'} title={'My Threads'}>
            <ThreadsContent
              threads={myThreads}
              grouped={myGroupedThreads}
              onResolve={handleResolveComment}
              formatDate={formatDate}
            />
          </ToolWindowPanel>
        </ToolWindow.TabContent>
      </ToolWindow.Tab>
    </ToolWindow.Root>
  );
};

type ThreadsContentProps = {
  threads: CommentThread[];
  grouped: { key: string; title: string; threads: CommentThread[] }[];
  onResolve: (comment: Comment) => void;
  formatDate: (date: Date) => string;
};

const ThreadsContent = ({ threads, grouped, onResolve, formatDate }: ThreadsContentProps) => (
  <div className={styles.icCommentsToolWindow}>
    {threads.length === 0 ? (
      <div className={styles.eNoComments}>No comments</div>
    ) : (
      grouped.map(group => (
        <div key={group.key} className={styles.eGroup}>
          {group.title && <div className={styles.eTitle}>{group.title}</div>}
          <ul>
            {group.threads.map(thread => (
              <CommentItem
                key={thread.root.id}
                thread={thread}
                onResolve={onResolve}
                formatDate={formatDate}
              />
            ))}
          </ul>
        </div>
      ))
    )}
  </div>
);
