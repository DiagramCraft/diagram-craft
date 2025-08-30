import { useApplication, useDiagram } from '../../../application';
import { Comment, type CommentState } from '@diagram-craft/model/comment';
import React, { useCallback, useState } from 'react';
import { TbCheck, TbDots, TbEdit, TbLink, TbMessageReply, TbTrash } from 'react-icons/tb';
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

export type CommentItemProps = {
  comment: Comment;
  onResolve: (comment: Comment) => void;
  formatDate: (date: Date) => string;
  level: number;
  children?: React.ReactNode;
};

type CommentItemMenuProps = {
  onEditComment: () => void;
  onChangeState: () => void;
  canChangeState: boolean;
  state: CommentState;
  onDeleteComment: () => void;
};

const CommentItemMenu = (props: CommentItemMenuProps) => (
  <DropdownMenu.Root>
    <DropdownMenu.Trigger asChild>
      <button className={styles['comment__menu-button']}>
        <TbDots size={14} />
      </button>
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content className="cmp-context-menu" side="left">
        <DropdownMenu.Item className="cmp-context-menu__item" onSelect={props.onEditComment}>
          <DropdownMenu.ItemIndicator className="cmp-context-menu__item-icon" forceMount={true}>
            <TbEdit size={14} />
          </DropdownMenu.ItemIndicator>
          Edit Comment
        </DropdownMenu.Item>
        <DropdownMenu.Item
          className="cmp-context-menu__item"
          onSelect={props.onChangeState}
          disabled={!props.canChangeState}
        >
          <DropdownMenu.ItemIndicator className="cmp-context-menu__item-icon" forceMount={true}>
            <TbCheck size={14} />
          </DropdownMenu.ItemIndicator>
          {props.state === 'resolved' ? 'Unresolve' : 'Resolve'}
        </DropdownMenu.Item>
        <DropdownMenu.Item className="cmp-context-menu__item" onSelect={props.onDeleteComment}>
          <DropdownMenu.ItemIndicator className="cmp-context-menu__item-icon" forceMount={true}>
            <TbTrash size={14} />
          </DropdownMenu.ItemIndicator>
          Delete Comment
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
);

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

    diagram.commentManager.addComment(newComment);
    setReplyText('');
  }, [diagram, comment, replyText]);

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
          diagram.commentManager.removeComment(comment.id);
        }
      )
    );
  }, [diagram, comment.id]);

  return (
    <div
      className={`${styles.comment} ${comment.isReply() ? styles['comment--reply'] : comment.state === 'unresolved' ? styles['comment--unresolved'] : styles['comment--resolved']}`}
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
        <div className={styles['comment__author-info']}>
          <div className={styles['comment__author-name']}>{comment.author}</div>
          <div className={styles.comment__date}>{formatDate(comment.date)}</div>
        </div>
        <div className={styles.comment__menu}>
          <CommentItemMenu
            onEditComment={() => application.actions.COMMENT_EDIT!.execute({ comment })}
            onChangeState={() => onResolve(comment)}
            canChangeState={!comment.isReply()}
            state={comment.state}
            onDeleteComment={handleDelete}
          />
        </div>
      </div>

      <div className={styles.comment__content}>{comment.message}</div>

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
          className={styles['comment__element-link']}
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
            className={styles['comment__reply-textarea']}
            onFocus={e => (e.currentTarget.style.height = '40px')}
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
