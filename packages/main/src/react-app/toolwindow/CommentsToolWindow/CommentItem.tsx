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

const MoreButton = ({ className }: { className?: string }) => (
  <MenuButton.Trigger element={<button type="button" className={className} aria-label="More options" />}>
    <TbDots size={14} />
  </MenuButton.Trigger>
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
    <li className={styles.icThread} data-resolved={isResolved || undefined}>
      <div className={styles.eRootComment}>
        <Avatar author={root.author} color={root.userColor} large />
        <div className={styles.eRootBody}>
          <div className={styles.eCommentRowTop}>
            <div>
              <div className={styles.eAuthor}>{root.author}</div>
              <div className={styles.eTime}>{formatDate(root.date)}</div>
            </div>
            <MenuButton.Root>
              <MoreButton className={styles.eMoreBtn} />
              <MenuButton.Menu>
                <Menu.Item
                  onClick={() => application.actions.COMMENT_EDIT!.execute({ comment: root })}
                  leftSlot={<TbEdit size={14} />}
                >
                  Edit comment
                </Menu.Item>
                <Menu.Item onClick={() => onResolve(root)} leftSlot={<TbCheck size={14} />}>
                  {isResolved ? 'Unresolve' : 'Resolve'}
                </Menu.Item>
                <Menu.Separator />
                <Menu.Item
                  onClick={() => confirmDelete(root.id, true)}
                  leftSlot={<TbTrash size={14} />}
                  type="danger"
                >
                  Delete comment
                </Menu.Item>
              </MenuButton.Menu>
            </MenuButton.Root>
          </div>

      <div className={styles.eContent}>{comment.message}</div>

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
          className={styles.eLink}
        >
          <TbLink />
          {getElementNameFromComment(comment)}
        </a>
      )}

      {canReply && (
        <div className={styles.eReply}>
          <TextArea
            value={replyText}
            onChange={value => setReplyText(value ?? '')}
            rows={1}
            placeholder="Reply to comment..."
            className={styles.eReplyTextArea}
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
          <Button variant={'secondary'} onClick={handleReply} disabled={replyText.trim() === ''}>
            <TbMessageReply />
          </Button>
        </div>
      )}

      {children}
    </div>
  );
};
