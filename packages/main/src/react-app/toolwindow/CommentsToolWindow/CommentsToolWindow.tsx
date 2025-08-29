import { useDiagram } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { Accordion } from '@diagram-craft/app-components/Accordion';
import { Comment } from '@diagram-craft/model/comment';
import { useCallback } from 'react';
import { TbUser, TbCalendar, TbCheck } from 'react-icons/tb';

type CommentThread = {
  root: Comment;
  replies: Comment[];
};

export const CommentsToolWindow = () => {
  const diagram = useDiagram();
  const redraw = useRedraw();

  useEventListener(diagram.document.commentManager, 'commentAdded', redraw);
  useEventListener(diagram.document.commentManager, 'commentUpdated', redraw);  
  useEventListener(diagram.document.commentManager, 'commentRemoved', redraw);

  // Compute comment threads on every render (will be fast since there aren't many comments)
  const allComments = diagram.document.commentManager.getAllCommentsForDiagram(diagram);
  const commentThreads: CommentThread[] = [];
  const processed = new Set<string>();

  // Find root comments (comments without parent)
  const rootComments = allComments.filter(c => !c.isReply());

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

  const handleResolveComment = useCallback((comment: Comment) => {
    if (comment.state === 'resolved') {
      comment.unresolve();
    } else {
      comment.resolve();
    }
    diagram.document.commentManager.updateComment(comment);
  }, [diagram]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getElementName = (comment: Comment) => {
    if (comment.type === 'diagram') return 'Diagram';
    if (comment.element) {
      return comment.element.type === 'node' ? `Node ${comment.element.id.slice(0, 8)}` : `Edge ${comment.element.id.slice(0, 8)}`;
    }
    return 'Unknown Element';
  };

  return (
    <Accordion.Root disabled={true} type="multiple" defaultValue={['comments']}>
      <Accordion.Item value="comments">
        <Accordion.ItemHeader>Comments</Accordion.ItemHeader>
        <Accordion.ItemContent>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '8px' }}>
            {commentThreads.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                color: 'var(--secondary-fg)', 
                fontSize: '14px',
                padding: '20px 0'
              }}>
                No comments
              </div>
            ) : (
              commentThreads.map(thread => (
                <div key={thread.root.id} style={{ marginBottom: '16px' }}>
                  <CommentItem 
                    comment={thread.root} 
                    onResolve={handleResolveComment}
                    formatDate={formatDate}
                    getElementName={getElementName}
                  />
                  {thread.replies.map(reply => (
                    <div key={reply.id} style={{ marginLeft: '20px', marginTop: '8px' }}>
                      <CommentItem 
                        comment={reply} 
                        onResolve={handleResolveComment}
                        formatDate={formatDate}
                        getElementName={getElementName}
                        isReply={true}
                      />
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

type CommentItemProps = {
  comment: Comment;
  onResolve: (comment: Comment) => void;
  formatDate: (date: Date) => string;
  getElementName: (comment: Comment) => string;
  isReply?: boolean;
};

const CommentItem = ({ comment, onResolve, formatDate, getElementName, isReply }: CommentItemProps) => {
  return (
    <div style={{
      border: '1px solid var(--border-color)',
      borderRadius: '6px',
      padding: '12px',
      backgroundColor: isReply ? 'var(--secondary-bg)' : 'var(--primary-bg)',
      position: 'relative'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        marginBottom: '8px'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            fontSize: '12px',
            color: 'var(--secondary-fg)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <TbUser size={12} />
              <span>{comment.author}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <TbCalendar size={12} />
              <span>{formatDate(comment.date)}</span>
            </div>
            <div style={{ 
              fontSize: '10px', 
              backgroundColor: comment.type === 'diagram' ? 'var(--accent-bg)' : 'var(--warning-bg)',
              color: comment.type === 'diagram' ? 'var(--accent-fg)' : 'var(--warning-fg)',
              padding: '2px 6px',
              borderRadius: '4px'
            }}>
              {getElementName(comment)}
            </div>
          </div>
        </div>
        <button
          onClick={() => onResolve(comment)}
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            color: comment.state === 'resolved' ? 'var(--success-fg)' : 'var(--secondary-fg)',
            backgroundColor: comment.state === 'resolved' ? 'var(--success-bg)' : 'transparent'
          }}
          title={comment.state === 'resolved' ? 'Mark as unresolved' : 'Mark as resolved'}
        >
          <TbCheck size={12} />
          {comment.state === 'resolved' ? 'Resolved' : 'Resolve'}
        </button>
      </div>
      
      <div style={{ 
        fontSize: '14px', 
        lineHeight: '1.4',
        wordBreak: 'break-word'
      }}>
        {comment.message}
      </div>
    </div>
  );
};