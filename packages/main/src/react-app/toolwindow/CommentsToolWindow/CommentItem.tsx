import { useApplication, useDiagram } from '../../../application';
import { useEventListener } from '../../hooks/useEventListener';
import { useRedraw } from '../../hooks/useRedraw';
import { Comment } from '@diagram-craft/model/comment';
import { useCallback, useRef, useState } from 'react';
import { TbCheck, TbDots, TbEdit, TbLink, TbSend, TbTrash } from 'react-icons/tb';
import styles from './CommentItem.module.css';
import { newid } from '@diagram-craft/utils/id';
import { getElementNameFromComment, type CommentThread } from './utils';
import { addHighlight, Highlights, removeHighlight } from '@diagram-craft/canvas/highlight';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/Menu';

export type CommentItemProps = {
  thread: CommentThread;
  onResolve: (comment: Comment) => void;
  formatDate: (date: Date) => string;
};

type AvatarProps = { author: string; color?: string; large?: boolean };

const Avatar = ({ author, color, large }: AvatarProps) => (
  <div
    className={styles.eAvatar}
    data-large={large || undefined}
    style={{ background: color ?? '#336633' }}
    aria-hidden="true"
  >
    {author
      .split(' ')
      .map(w => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()}
  </div>
);

const MoreButton = ({ className }: { className?: string }) => (
  <MenuButton.Trigger
    element={
      <button type="button" className={className} aria-label="More options">
        <TbDots size={14} />
      </button>
    }
  />
);

export const CommentItem = ({ thread, onResolve, formatDate }: CommentItemProps) => {
  const application = useApplication();
  const diagram = useDiagram();
  const redraw = useRedraw();
  const [replyText, setReplyText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { root } = thread;
  const isResolved = root.state === 'resolved';
  const { replies: flatReplies } = thread;
  const userState = application.awareness.state;

  useEventListener(application.awareness, 'change', redraw);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const handleReply = useCallback(() => {
    if (replyText.trim() === '') return;
    const newComment = new Comment(
      diagram,
      root.type,
      newid(),
      replyText.trim(),
      userState.name,
      new Date(),
      'unresolved',
      root.element,
      root.id,
      userState.color
    );
    diagram.commentManager.addComment(newComment);
    setReplyText('');
  }, [diagram, root, replyText, userState]);

  const confirmDelete = useCallback(
    (commentId: string, isThread: boolean) => {
      application.ui.showDialog(
        new MessageDialogCommand(
          {
            title: 'Confirm delete',
            message: isThread
              ? 'Are you sure you want to delete this comment? This action cannot be undone. This will also delete all replies to this comment.'
              : 'Are you sure you want to delete this reply? This action cannot be undone.',
            okLabel: 'Yes',
            cancelLabel: 'No'
          },
          () => diagram.commentManager.removeComment(commentId)
        )
      );
    },
    [diagram, application]
  );

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

          <div className={styles.eText}>{root.message}</div>

          {root.type === 'element' && (
            <a
              href="#"
              onClick={e => {
                e.preventDefault();
                addHighlight(root.element!, Highlights.NODE__HIGHLIGHT);
                setTimeout(() => removeHighlight(root.element, Highlights.NODE__HIGHLIGHT), 1000);
              }}
              className={styles.eAnchorLink}
            >
              <TbLink size={11} />
              {getElementNameFromComment(root)}
            </a>
          )}

          {isResolved && (
            <div>
              <div className={styles.eResolvedPill}>
                <TbCheck size={11} />
                Resolved
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={styles.eReplies}>
        {flatReplies.map((reply, idx) => (
          <div
            key={reply.id}
            className={styles.eReplyRow}
            data-last={idx === flatReplies.length - 1 || undefined}
          >
            <Avatar author={reply.author} color={reply.userColor} />
            <div className={styles.eReplyBody}>
              <div className={styles.eReplyHeader}>
                <span className={styles.eReplyAuthor}>{reply.author}</span>
                <span className={styles.eReplyTime}>{formatTime(reply.date)}</span>
                <MenuButton.Root>
                  <MoreButton className={styles.eMoreBtn} />
                  <MenuButton.Menu>
                    <Menu.Item
                      onClick={() => application.actions.COMMENT_EDIT!.execute({ comment: reply })}
                      leftSlot={<TbEdit size={14} />}
                    >
                      Edit comment
                    </Menu.Item>
                    <Menu.Separator />
                    <Menu.Item
                      onClick={() => confirmDelete(reply.id, false)}
                      leftSlot={<TbTrash size={14} />}
                      type="danger"
                    >
                      Delete comment
                    </Menu.Item>
                  </MenuButton.Menu>
                </MenuButton.Root>
              </div>
              <div className={styles.eReplyText}>{reply.message}</div>
            </div>
          </div>
        ))}

        <div className={styles.eComposer}>
          <Avatar author={userState.name} color={userState.color} />
          <input
            ref={inputRef}
            className={styles.eComposerInput}
            type="text"
            placeholder="Reply…"
            aria-label="Reply to thread"
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleReply();
              }
              if (e.key === 'Escape') {
                setReplyText('');
                inputRef.current?.blur();
              }
            }}
          />
          <button
            type="button"
            className={styles.eSendBtn}
            onClick={handleReply}
            disabled={replyText.trim() === ''}
            title="Send reply"
            aria-label="Send reply"
          >
            <TbSend size={13} />
          </button>
        </div>
      </div>
    </li>
  );
};
