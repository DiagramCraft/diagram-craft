import { type CSSProperties, useState } from 'react';
import { TbCheck, TbMessage, TbPencil, TbTrash } from 'react-icons/tb';
import type { WikiComment } from '@arch-register/api-types/wikiCommentContract';
import { isTextAnchorStale } from '@arch-register/api-types/textAnchor';
import { MemberAvatar } from '../../components/MemberAvatar';
import { formatDateTime } from '../../utils/dateFormat';
import { Composer } from './WikiCommentComposer';
import styles from './WikiCommentThreadCard.module.css';

type PostProps = {
  post: WikiComment;
  reply?: boolean;
  currentUserId: string | null;
  replying: boolean;
  onReply: () => void;
  onEdit: (body: string) => void;
  onDelete: () => void;
};

const CommentPostItem = ({
  post,
  reply,
  currentUserId,
  replying,
  onReply,
  onEdit,
  onDelete
}: PostProps) => {
  const [editing, setEditing] = useState(false);
  const isAuthor = currentUserId != null && currentUserId === post.authorId;

  return (
    <div className={reply ? styles.postReply : styles.post}>
      <MemberAvatar
        name={post.authorName}
        email={null}
        userId={post.authorId ?? 'unknown'}
        size={22}
        hideTooltip
      />
      <div className={styles.postBody}>
        <div className={styles.postHead}>
          <span className={styles.postAuthor}>{post.authorName}</span>
          <span className={styles.postWhen}>{formatDateTime(post.createdAt)}</span>
          {post.editedAt && (
            <span className={styles.postEdited}>edited {formatDateTime(post.editedAt)}</span>
          )}
        </div>

        {editing ? (
          <Composer
            autoFocus
            initialValue={post.body}
            placeholder="Edit your comment…"
            submitLabel="Save"
            onCancel={() => setEditing(false)}
            onSubmit={body => {
              onEdit(body);
              setEditing(false);
            }}
          />
        ) : (
          <>
            <div className={styles.postText}>{post.body}</div>
            <div className={styles.postActions}>
              <button
                type="button"
                className={`${styles.textBtn} ${replying ? styles.textBtnActive : ''}`}
                onClick={onReply}
              >
                <TbMessage size={11} />
                {replying ? 'Cancel' : 'Reply'}
              </button>
              {isAuthor && (
                <>
                  <button type="button" className={styles.textBtn} onClick={() => setEditing(true)}>
                    <TbPencil size={11} />
                    Edit
                  </button>
                  <button type="button" className={styles.textBtnDanger} onClick={onDelete}>
                    <TbTrash size={11} />
                    Delete
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/**
 * A single comment thread (root post + its flat replies), with quote, resolve, reply and
 * edit/delete controls. Shared between the margin rail (`side` display mode) and the
 * click-to-popup card (`inline` display mode) so both present threads identically.
 */
export const WikiCommentThreadCard = ({
  post,
  replies,
  plainText,
  currentUserId,
  active,
  onQuoteClick,
  onReply,
  onEdit,
  onDelete,
  onResolve,
  cardRef,
  style,
  className
}: {
  post: WikiComment;
  replies: WikiComment[];
  /** Current rendered plain text of the page, used to detect stale anchors. */
  plainText: string;
  currentUserId: string | null;
  active: boolean;
  onQuoteClick?: () => void;
  onReply: (body: string) => void;
  onEdit: (postId: string, body: string) => void;
  onDelete: (postId: string) => void;
  onResolve: () => void;
  cardRef?: (el: HTMLDivElement | null) => void;
  style?: CSSProperties;
  className?: string;
}) => {
  const [replyOpen, setReplyOpen] = useState(false);
  const stale = isTextAnchorStale(plainText, post.anchor);
  const resolved = post.resolvedAt != null;

  return (
    <div
      ref={cardRef}
      style={style}
      className={`${styles.root} ${active ? styles.rootActive : ''} ${resolved ? styles.rootResolved : ''} ${className ?? ''}`}
    >
      <div className={`${styles.quote} ${stale ? styles.quoteStale : ''}`} onClick={onQuoteClick}>
        &ldquo;{post.anchor.quote}&rdquo;
        {stale && <span className={styles.staleBadge}>Text not found</span>}
        {resolved && <span className={styles.resolvedBadge}>Resolved</span>}
      </div>

      <CommentPostItem
        post={post}
        currentUserId={currentUserId}
        replying={replyOpen}
        onReply={() => setReplyOpen(o => !o)}
        onEdit={body => onEdit(post.id, body)}
        onDelete={() => onDelete(post.id)}
      />

      <div className={styles.postActions}>
        <button type="button" className={styles.textBtn} onClick={onResolve}>
          <TbCheck size={11} />
          {resolved ? 'Reopen' : 'Resolve'}
        </button>
      </div>

      {(replies.length > 0 || replyOpen) && (
        <div className={styles.replies}>
          {replies.map(reply => (
            <CommentPostItem
              key={reply.id}
              post={reply}
              reply
              currentUserId={currentUserId}
              replying={false}
              onReply={() => setReplyOpen(o => !o)}
              onEdit={body => onEdit(reply.id, body)}
              onDelete={() => onDelete(reply.id)}
            />
          ))}
          {replyOpen && (
            <Composer
              autoFocus
              placeholder="Write a reply…"
              onCancel={() => setReplyOpen(false)}
              onSubmit={body => {
                onReply(body);
                setReplyOpen(false);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};
