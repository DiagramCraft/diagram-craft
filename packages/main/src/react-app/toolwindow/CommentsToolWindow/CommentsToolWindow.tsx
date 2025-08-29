import { useDiagram } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { Accordion } from '@diagram-craft/app-components/Accordion';
import { Comment } from '@diagram-craft/model/comment';
import React, { useCallback, useState } from 'react';
import { TbCheck, TbLink, TbMessageReply } from 'react-icons/tb';
import {
  type CommentThread,
  getElementNameFromComment,
  type GroupBy,
  groupThreadsByAuthor,
  groupThreadsByElement,
  type SortBy
} from './utils';
import { CommentsSortMenu } from './CommentsSortMenu';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { Button } from '@diagram-craft/app-components/Button';

export const CommentsToolWindow = () => {
  const diagram = useDiagram();
  const redraw = useRedraw();
  const [sortBy, setSortBy] = useState<SortBy>('date-desc');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');

  useEventListener(diagram.document.commentManager, 'commentAdded', redraw);
  useEventListener(diagram.document.commentManager, 'commentUpdated', redraw);
  useEventListener(diagram.document.commentManager, 'commentRemoved', redraw);

  const handleResolveComment = useCallback(
    (comment: Comment) => {
      if (comment.state === 'resolved') {
        comment.unresolve();
      } else {
        comment.resolve();
      }
      diagram.document.commentManager.updateComment(comment);
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
  const allComments = diagram.document.commentManager.getAllCommentsForDiagram(diagram);

  // Sort comments
  const sortedComments = [...allComments].sort((a, b) => {
    if (sortBy === 'date-asc') {
      return a.date.getTime() - b.date.getTime();
    } else {
      return b.date.getTime() - a.date.getTime();
    }
  });

  const commentThreads: CommentThread[] = [];
  const processed = new Set<string>();

  // Find root comments (comments without parent)
  const rootComments = sortedComments.filter(c => !c.isReply());

  for (const rootComment of rootComments) {
    if (processed.has(rootComment.id)) continue;

    const thread = diagram.document.commentManager.getCommentThread(rootComment);
    const replies = thread.slice(1); // Remove the root comment from replies

    commentThreads.push({
      root: rootComment,
      replies: replies
    });

    // Mark all comments in this thread as processed
    thread.forEach(c => processed.add(c.id));
  }

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
              onSortChange={setSortBy}
              onGroupChange={setGroupBy}
            />
          </Accordion.ItemHeaderButtons>
        </Accordion.ItemHeader>
        <Accordion.ItemContent>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {commentThreads.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  color: 'var(--secondary-fg)',
                  padding: '20px 0'
                }}
              >
                No comments
              </div>
            ) : (
              groupedThreads.map(group => (
                <div
                  key={group.key}
                  style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
                >
                  {group.title && (
                    <div
                      style={{
                        fontWeight: 'bold',
                        color: 'var(--secondary-fg)'
                      }}
                    >
                      {group.title}
                    </div>
                  )}
                  {group.threads.map(thread => (
                    <React.Fragment key={thread.root.id}>
                      <CommentItem
                        comment={thread.root}
                        onResolve={handleResolveComment}
                        formatDate={formatDate}
                      />
                      {thread.replies.map(reply => (
                        <div key={reply.id} style={{ marginLeft: '20px', marginTop: '8px' }}>
                          <CommentItem
                            comment={reply}
                            onResolve={handleResolveComment}
                            formatDate={formatDate}
                            isReply={true}
                          />
                        </div>
                      ))}
                    </React.Fragment>
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

type CommentItemProps = {
  comment: Comment;
  onResolve: (comment: Comment) => void;
  formatDate: (date: Date) => string;
  isReply?: boolean;
};

const CommentItem = ({ comment, onResolve, formatDate, isReply }: CommentItemProps) => {
  return (
    <div
      style={{
        border: `1px solid ${comment.state === 'unresolved' ? 'var(--cmp-focus-border)' : 'var(--cmp-border)'}`,
        borderRadius: '6px',
        padding: '12px',
        backgroundColor: isReply ? 'var(--tertiary-bg)' : 'var(--secondary-bg)',
        position: 'relative'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          style={{
            background: '#336633',
            height: '20px',
            aspectRatio: '1 / 1',
            borderRadius: '50%',
            position: 'relative',
            color: 'var(--primary-bg)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: '10px'
          }}
        >
          {comment.author
            .split(' ')
            .map(e => e[0])
            .slice(0, 2)
            .join('')
            .toUpperCase()}
        </div>
        <div>
          <div>{comment.author}</div>
          <div>{formatDate(comment.date)}</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <TbCheck
            size={12}
            style={{
              color: comment.state === 'resolved' ? 'var(--highlight-fg)' : 'var(--tertiary-fg)',
              cursor: 'pointer'
            }}
            onClick={() => onResolve(comment)}
          />
        </div>
      </div>

      <div
        style={{
          lineHeight: '1.4',
          wordBreak: 'break-word',
          margin: '0.25rem 0'
        }}
      >
        {comment.message}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '0.5rem' }}>
        <TbLink />
        {getElementNameFromComment(comment)}
      </div>

      {/* Ability to respond to comments */}
      <div style={{ display: 'flex', gap: '0.25rem' }}>
        <TextArea
          value={''}
          rows={1}
          style={{ width: '100%', resize: 'none' }}
          onFocus={e => {
            e.currentTarget.style.height = '40px';
          }}
          onBlur={e => {
            e.currentTarget.style.height = 'initial';
          }}
        />
        <Button type={'secondary'}>
          <TbMessageReply />
        </Button>
      </div>
    </div>
  );
};
