import { useDiagram } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { Accordion } from '@diagram-craft/app-components/Accordion';
import { Comment } from '@diagram-craft/model/comment';
import React, { useCallback, useState } from 'react';
import { TbCheck, TbLink, TbMessageReply } from 'react-icons/tb';
import { UserState } from '../../../UserState';
import {
  buildCommentThreads,
  type CommentThreadNode,
  getElementNameFromComment,
  type GroupBy,
  groupThreadsByAuthor,
  groupThreadsByElement,
  type SortBy
} from './utils';
import { CommentsSortMenu } from './CommentsSortMenu';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { Button } from '@diagram-craft/app-components/Button';
import { newid } from '@diagram-craft/utils/id';

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

  // Sort root comments, but preserve chronological order for replies within threads
  const sortedComments = [...allComments].sort((a, b) => {
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
                    <div key={thread.root.id} style={{ marginBottom: '16px' }}>
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
          <div style={{ marginLeft: `${(replyNode.level - 1) * 20}px`, marginTop: '8px' }}>
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

type CommentItemProps = {
  comment: Comment;
  onResolve: (comment: Comment) => void;
  formatDate: (date: Date) => string;
  level: number;
  children?: React.ReactNode;
};

const CommentItem = ({ comment, onResolve, formatDate, level, children }: CommentItemProps) => {
  const diagram = useDiagram();
  const [replyText, setReplyText] = useState<string>('');

  const canReply = level < 2;

  const handleReply = useCallback(() => {
    if (replyText.trim() === '') return;

    const userState = UserState.get().awarenessState;
    const newComment = new Comment(
      diagram,
      comment.type,
      newid(),
      replyText.trim(),
      userState.name,
      new Date(),
      'unresolved',
      comment.element,
      comment.id,
      userState.color
    );

    diagram.document.commentManager.addComment(newComment);
    setReplyText('');
  }, [diagram, comment, replyText]);
  return (
    <div
      style={{
        border: `1px solid ${comment.state === 'unresolved' && !comment.isReply() ? 'var(--cmp-focus-border)' : 'var(--cmp-border)'}`,
        borderRadius: '6px',
        padding: '12px',
        backgroundColor: comment.isReply() ? 'var(--primary-bg)' : 'var(--secondary-bg)',
        position: 'relative'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          style={{
            background: comment.userColor ?? '#336633',
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
        {!comment.isReply() && (
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
        )}
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

      {!comment.isReply() && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '0.5rem' }}>
          <TbLink />
          {getElementNameFromComment(comment)}
        </div>
      )}

      {/* Ability to respond to comments - only show if replies are allowed */}
      {canReply && (
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <TextArea
            value={replyText}
            onChange={value => setReplyText(value ?? '')}
            rows={1}
            placeholder="Reply to comment..."
            style={{ width: '100%', resize: 'none' }}
            onFocus={e => {
              e.currentTarget.style.height = '40px';
            }}
            onBlur={e => {
              if (replyText.trim() === '') {
                e.currentTarget.style.height = 'initial';
              }
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleReply();
              }
              if (e.key === 'Escape') {
                setReplyText('');
                e.currentTarget.style.height = 'initial';
                e.currentTarget.blur();
              }
            }}
          />
          <Button type={'secondary'} onClick={handleReply} disabled={replyText.trim() === ''}>
            <TbMessageReply />
          </Button>
        </div>
      )}

      {children}
    </div>
  );
};
