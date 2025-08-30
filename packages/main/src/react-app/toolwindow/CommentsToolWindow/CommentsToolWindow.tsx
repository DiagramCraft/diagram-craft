import { useDiagram } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { Accordion } from '@diagram-craft/app-components/Accordion';
import { Comment } from '@diagram-craft/model/comment';
import { useCallback, useState } from 'react';
import {
  buildCommentThreads,
  type CommentThreadNode,
  type GroupBy,
  groupThreadsByAuthor,
  groupThreadsByElement,
  type SortBy
} from './utils';
import { CommentsSortMenu } from './CommentsSortMenu';
import { CommentItem } from './CommentItem';
import styles from './CommentsToolWindow.module.css';

export const CommentsToolWindow = () => {
  const diagram = useDiagram();
  const redraw = useRedraw();
  const [sortBy, setSortBy] = useState<SortBy>('date-desc');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [hideResolved, setHideResolved] = useState<boolean>(false);

  useEventListener(diagram.commentManager, 'commentAdded', redraw);
  useEventListener(diagram.commentManager, 'commentUpdated', redraw);
  useEventListener(diagram.commentManager, 'commentRemoved', redraw);

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
  const allComments = diagram.commentManager.getAllCommentsForDiagram(diagram);

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

  // Build nested comment threads
  const commentThreads = buildCommentThreads(sortedComments);

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

  return (
    <Accordion.Root disabled={false} type="multiple" defaultValue={['comments']}>
      <Accordion.Item value="comments">
        <Accordion.ItemHeader>
          Comments
          <Accordion.ItemHeaderButtons>
            <CommentsSortMenu
              sortBy={sortBy}
              groupBy={groupBy}
              hideResolved={hideResolved}
              onSortChange={setSortBy}
              onGroupChange={setGroupBy}
              onHideResolvedChange={setHideResolved}
            />
          </Accordion.ItemHeaderButtons>
        </Accordion.ItemHeader>
        <Accordion.ItemContent>
          <div className={styles['comments-tool-window']}>
            {commentThreads.length === 0 ? (
              <div className={styles['comments-tool-window__no-comments']}>No comments</div>
            ) : (
              groupedThreads.map(group => (
                <div key={group.key} className={styles['comments-tool-window__group']}>
                  {group.title && (
                    <div className={styles['comments-tool-window__group-title']}>{group.title}</div>
                  )}
                  {group.threads.map(thread => (
                    <div key={thread.root.id} className={styles['comments-tool-window__thread']}>
                      <CommentItem
                        comment={thread.root}
                        onResolve={handleResolveComment}
                        formatDate={formatDate}
                        level={0}
                      >
                        <NestedReplies
                          replies={thread.replies}
                          onResolve={handleResolveComment}
                          formatDate={formatDate}
                        />
                      </CommentItem>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </Accordion.ItemContent>
      </Accordion.Item>
    </Accordion.Root>
  );
};

type NestedRepliesProps = {
  replies: CommentThreadNode[];
  onResolve: (comment: Comment) => void;
  formatDate: (date: Date) => string;
};

const NestedReplies = ({ replies, onResolve, formatDate }: NestedRepliesProps) => {
  return (
    <>
      {replies.map(replyNode => (
        <div key={replyNode.comment.id}>
          <div
            className={styles['comments-tool-window__nested-reply']}
            style={{ marginLeft: `${(replyNode.level - 1) * 20}px` }}
          >
            <CommentItem
              comment={replyNode.comment}
              onResolve={onResolve}
              formatDate={formatDate}
              level={replyNode.level}
            />
          </div>
          <NestedReplies
            replies={replyNode.replies}
            onResolve={onResolve}
            formatDate={formatDate}
          />
        </div>
      ))}
    </>
  );
};
