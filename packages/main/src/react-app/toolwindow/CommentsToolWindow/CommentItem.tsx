import { useDiagram } from '../../../application';
import { Comment } from '@diagram-craft/model/comment';
import React, { useCallback, useState } from 'react';
import { TbCheck, TbLink, TbMessageReply, TbEdit, TbTrash, TbDots } from 'react-icons/tb';
import { UserState } from '../../../UserState';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { Button } from '@diagram-craft/app-components/Button';
import { newid } from '@diagram-craft/utils/id';
import { getElementNameFromComment } from './utils';
import { addHighlight, Highlights, removeHighlight } from '@diagram-craft/canvas/highlight';

export type CommentItemProps = {
  comment: Comment;
  onResolve: (comment: Comment) => void;
  formatDate: (date: Date) => string;
  level: number;
  children?: React.ReactNode;
};

export const CommentItem = ({
  comment,
  onResolve,
  formatDate,
  level,
  children
}: CommentItemProps) => {
  const diagram = useDiagram();
  const [replyText, setReplyText] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editText, setEditText] = useState<string>(comment.message);

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

  const handleEdit = useCallback(() => {
    setIsEditing(true);
    setEditText(comment.message);
  }, [comment.message]);

  const handleSaveEdit = useCallback(() => {
    if (editText.trim() === '') return;

    const updatedComment = new Comment(
      diagram,
      comment.type,
      comment.id,
      editText.trim(),
      comment.author,
      comment.date,
      comment.state,
      comment.element,
      comment.parentId,
      comment.userColor
    );

    diagram.document.commentManager.updateComment(updatedComment);
    setIsEditing(false);
  }, [diagram, comment, editText]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditText(comment.message);
  }, [comment.message]);

  const handleDelete = useCallback(() => {
    diagram.document.commentManager.removeComment(comment.id);
  }, [diagram, comment.id]);

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
        <div style={{ marginLeft: 'auto' }}>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--tertiary-fg)',
                  padding: '4px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <TbDots size={14} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="cmp-context-menu" side="left">
                <DropdownMenu.Item className="cmp-context-menu__item" onSelect={handleEdit}>
                  <DropdownMenu.ItemIndicator
                    className="cmp-context-menu__item-icon"
                    forceMount={true}
                  >
                    <TbEdit size={14} />
                  </DropdownMenu.ItemIndicator>
                  Edit Comment
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="cmp-context-menu__item"
                  onSelect={() => onResolve(comment)}
                  disabled={comment.isReply()}
                >
                  <DropdownMenu.ItemIndicator
                    className="cmp-context-menu__item-icon"
                    forceMount={true}
                  >
                    <TbCheck size={14} />
                  </DropdownMenu.ItemIndicator>
                  {comment.state === 'resolved' ? 'Unresolve' : 'Resolve'}
                </DropdownMenu.Item>
                <DropdownMenu.Item className="cmp-context-menu__item" onSelect={handleDelete}>
                  <DropdownMenu.ItemIndicator
                    className="cmp-context-menu__item-icon"
                    forceMount={true}
                  >
                    <TbTrash size={14} />
                  </DropdownMenu.ItemIndicator>
                  Delete Comment
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      <div
        style={{
          lineHeight: '1.4',
          wordBreak: 'break-word',
          margin: '0.25rem 0'
        }}
      >
        {isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <TextArea
              value={editText}
              onChange={value => setEditText(value ?? '')}
              rows={2}
              style={{ width: '100%', resize: 'none' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <Button type="secondary" onClick={handleCancelEdit}>
                Cancel
              </Button>
              <Button type="primary" onClick={handleSaveEdit} disabled={editText.trim() === ''}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          comment.message
        )}
      </div>

      {!comment.isReply() && comment.type === 'element' && (
        <a
          href="#"
          onClick={() => {
            addHighlight(comment.element!, Highlights.NODE__HIGHLIGHT);
            setTimeout(() => {
              removeHighlight(comment.element!, Highlights.NODE__HIGHLIGHT);
            }, 1000);
            return false;
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginBottom: '0.5rem'
          }}
        >
          <TbLink />
          {getElementNameFromComment(comment)}
        </a>
      )}

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
