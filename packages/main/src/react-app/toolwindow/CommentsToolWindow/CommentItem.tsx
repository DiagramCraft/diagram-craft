import { useApplication, useDiagram } from '../../../application';
import { Comment } from '@diagram-craft/model/comment';
import React, { useCallback, useState } from 'react';
import { TbCheck, TbLink, TbMessageReply, TbEdit, TbTrash, TbDots } from 'react-icons/tb';
import { UserState } from '../../../UserState';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { Button } from '@diagram-craft/app-components/Button';
import { Tooltip } from '@diagram-craft/app-components/Tooltip';
import styles from './CommentItem.module.css';
import { newid } from '@diagram-craft/utils/id';
import { getElementNameFromComment } from './utils';
import { addHighlight, Highlights, removeHighlight } from '@diagram-craft/canvas/highlight';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import { CommentDialog } from '../../toolbar/CommentDialog';

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
  const application = useApplication();
  const diagram = useDiagram();
  const [replyText, setReplyText] = useState<string>('');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false);

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
    setIsEditDialogOpen(true);
  }, []);

  const handleEditDialogChange = useCallback((open: boolean) => {
    setIsEditDialogOpen(open);
  }, []);

  const handleDelete = useCallback(() => {
    application.ui.showDialog(
      new MessageDialogCommand(
        {
          title: 'Confirm delete',
          message:
            'Are you sure you want to delete this comment? This action cannot be undone. This will also delete all replies to this comment.',
          okLabel: 'Yes',
          cancelLabel: 'No'
        },
        () => {
          diagram.document.commentManager.removeComment(comment.id);
        }
      )
    );
  }, [diagram, comment.id]);

  return (
    <div
      className={`${styles.comment} ${
        comment.isReply()
          ? styles['comment--reply']
          : comment.state === 'unresolved'
            ? styles['comment--unresolved']
            : styles['comment--resolved']
      }`}
    >
      <div className={styles.comment__header}>
        <Tooltip message={comment.author}>
          <div
            className={styles.comment__avatar}
            style={{
              background: comment.userColor ?? '#336633'
            }}
          >
            {comment.author
              .split(' ')
              .map(e => e[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()}
          </div>
        </Tooltip>
        <div className={styles.comment__authorInfo}>
          <div className={styles.comment__authorName}>{comment.author}</div>
          <div className={styles.comment__date}>{formatDate(comment.date)}</div>
        </div>
        <div className={styles.comment__menu}>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className={styles.comment__menuButton}>
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

      <div className={styles.comment__content}>
        {comment.message}
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
          className={styles.comment__elementLink}
        >
          <TbLink />
          {getElementNameFromComment(comment)}
        </a>
      )}

      {canReply && (
        <div className={styles.comment__reply}>
          <TextArea
            value={replyText}
            onChange={value => setReplyText(value ?? '')}
            rows={1}
            placeholder="Reply to comment..."
            className={styles.comment__replyTextarea}
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
      
      <CommentDialog
        open={isEditDialogOpen}
        onOpenChange={handleEditDialogChange}
        diagram={diagram}
        commentToEdit={comment}
      />
    </div>
  );
};
