import { useApplication, useDiagram } from '../../../application';
import { Comment, type CommentState } from '@diagram-craft/model/comment';
import React, { useCallback, useState } from 'react';
import { TbCheck, TbDots, TbEdit, TbLink, TbMessageReply, TbTrash } from 'react-icons/tb';
import { UserState } from '../../../UserState';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { Button } from '@diagram-craft/app-components/Button';
import { Tooltip } from '@diagram-craft/app-components/Tooltip';
import styles from './CommentItem.module.css';
import { newid } from '@diagram-craft/utils/id';
import { getElementNameFromComment } from './utils';
import { addHighlight, Highlights, removeHighlight } from '@diagram-craft/canvas/highlight';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/Menu';

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
  <MenuButton.Root>
    <MenuButton.Trigger className={styles['comment__menu-button']}>
      <TbDots size={14} />
    </MenuButton.Trigger>
    <MenuButton.Menu>
      <Menu.Item onClick={props.onEditComment} icon={<TbEdit size={14} />}>
        Edit Comment
      </Menu.Item>
      <Menu.Item
        onClick={props.onChangeState}
        disabled={!props.canChangeState}
        icon={<TbCheck size={14} />}
      >
        {props.state === 'resolved' ? 'Unresolve' : 'Resolve'}
      </Menu.Item>
      <Menu.Item onClick={props.onDeleteComment} icon={<TbTrash size={14} />}>
        Delete Comment
      </Menu.Item>
    </MenuButton.Menu>
  </MenuButton.Root>
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
  }, [diagram, comment.id, application]);

  return (
    <div
      className={`${styles.comment} ${comment.isReply() ? styles['comment--reply'] : comment.state === 'unresolved' ? styles['comment--unresolved'] : styles['comment--resolved']}`}
    >
      <div className={styles.comment__header}>
        <Tooltip
          message={comment.author}
          element={
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
          }
        />
        <div>
          <div>{comment.author}</div>
          <div>{formatDate(comment.date)}</div>
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
              removeHighlight(comment.element, Highlights.NODE__HIGHLIGHT);
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
