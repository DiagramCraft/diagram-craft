import { useEffect, useMemo, useRef, useState } from 'react';
import { TbCheck, TbMessage, TbMessageCircle, TbPencil, TbTrash } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import type { WikiComment } from '@arch-register/api-types/wikiCommentContract';
import type { TextAnchor } from '@arch-register/api-types/textAnchor';
import { isTextAnchorStale } from '@arch-register/api-types/textAnchor';
import { useAuth } from '../../auth/AuthContext';
import { MemberAvatar } from '../../components/MemberAvatar';
import {
  useCreateWikiComment,
  useDeleteWikiComment,
  useResolveWikiComment,
  useUpdateWikiComment,
  useWikiComments
} from '../../hooks/useWikiComments';
import { formatDateTime } from '../../utils/dateFormat';
import { EmptyState } from '../../components/EmptyState';
import styles from './WikiInlineCommentsPanel.module.css';

type ComposerProps = {
  placeholder: string;
  submitLabel?: string;
  autoFocus?: boolean;
  initialValue?: string;
  onSubmit: (body: string) => void;
  onCancel?: () => void;
};

const Composer = ({
  placeholder,
  submitLabel = 'Comment',
  autoFocus,
  initialValue = '',
  onSubmit,
  onCancel
}: ComposerProps) => {
  const [value, setValue] = useState(initialValue);
  const trimmed = value.trim();

  return (
    <div className={styles.composer}>
      <textarea
        className={styles.composerInput}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        rows={2}
        onChange={e => setValue(e.target.value)}
      />
      <div className={styles.composerRow}>
        {onCancel && (
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          variant="primary"
          size="sm"
          disabled={!trimmed}
          onClick={() => {
            if (!trimmed) return;
            onSubmit(trimmed);
            setValue('');
          }}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
};

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
        size={26}
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

export const WikiInlineCommentsPanel = ({
  workspaceId,
  nodeId,
  plainText,
  activeCommentId,
  onActiveCommentChange,
  draftAnchor,
  onDraftHandled
}: {
  workspaceId: string;
  nodeId: string;
  /** Current rendered plain text of the page, used to detect stale anchors. */
  plainText: string;
  activeCommentId: string | null;
  onActiveCommentChange: (id: string | null) => void;
  /** A pending selection waiting to become a new root comment, or null. */
  draftAnchor: TextAnchor | null;
  onDraftHandled: () => void;
}) => {
  const { user } = useAuth();
  const { data: comments = [], isLoading } = useWikiComments(workspaceId, nodeId);
  const createComment = useCreateWikiComment(workspaceId, nodeId);
  const updateComment = useUpdateWikiComment(workspaceId, nodeId);
  const resolveComment = useResolveWikiComment(workspaceId, nodeId);
  const deleteComment = useDeleteWikiComment(workspaceId, nodeId);

  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const entryRefs = useRef(new Map<string, HTMLDivElement>());

  const roots = useMemo(() => comments.filter(c => !c.parentPostId), [comments]);
  const repliesOf = (id: string) => comments.filter(c => c.parentPostId === id);

  useEffect(() => {
    if (!activeCommentId) return;
    entryRefs.current.get(activeCommentId)?.scrollIntoView({ block: 'nearest' });
  }, [activeCommentId]);

  if (isLoading) return null;

  return (
    <div className={styles.panel}>
      {draftAnchor && (
        <div className={styles.root}>
          <div className={styles.draftQuote}>&ldquo;{draftAnchor.quote}&rdquo;</div>
          <Composer
            autoFocus
            placeholder="Add a comment…"
            onCancel={onDraftHandled}
            onSubmit={body => {
              createComment.mutate({ nodeId, body, anchor: draftAnchor });
              onDraftHandled();
            }}
          />
        </div>
      )}

      {comments.length === 0 && !draftAnchor && (
        <EmptyState
          icon={<TbMessageCircle size={18} />}
          title="No inline comments yet"
          subtitle="Select text in the page to leave a comment on it."
        />
      )}

      {roots.map(post => {
        const replies = repliesOf(post.id);
        const isReplyingHere = replyTo === post.id || replies.some(r => r.id === replyTo);
        const stale = isTextAnchorStale(plainText, post.anchor);
        const resolved = post.resolvedAt != null;

        return (
          <div
            key={post.id}
            ref={el => {
              if (el) entryRefs.current.set(post.id, el);
              else entryRefs.current.delete(post.id);
            }}
            className={`${styles.root} ${post.id === activeCommentId ? styles.rootActive : ''} ${resolved ? styles.rootResolved : ''}`}
          >
            <div
              className={`${styles.quote} ${stale ? styles.quoteStale : ''}`}
              onClick={() => onActiveCommentChange(post.id)}
            >
              &ldquo;{post.anchor.quote}&rdquo;
              {stale && <span className={styles.staleBadge}>Text not found</span>}
              {resolved && <span className={styles.resolvedBadge}>Resolved</span>}
            </div>

            <CommentPostItem
              post={post}
              currentUserId={user?.id ?? null}
              replying={replyTo === post.id}
              onReply={() => setReplyTo(r => (r === post.id ? null : post.id))}
              onEdit={body => updateComment.mutate({ postId: post.id, body: { body } })}
              onDelete={() => setDeleteTarget(post.id)}
            />

            <div className={styles.postActions}>
              <button
                type="button"
                className={styles.textBtn}
                onClick={() => resolveComment.mutate({ postId: post.id, resolved: !resolved })}
              >
                <TbCheck size={11} />
                {resolved ? 'Reopen' : 'Resolve'}
              </button>
            </div>

            {(replies.length > 0 || isReplyingHere) && (
              <div className={styles.replies}>
                {replies.map(reply => (
                  <CommentPostItem
                    key={reply.id}
                    post={reply}
                    reply
                    currentUserId={user?.id ?? null}
                    replying={replyTo === reply.id}
                    onReply={() => setReplyTo(r => (r === reply.id ? null : reply.id))}
                    onEdit={body => updateComment.mutate({ postId: reply.id, body: { body } })}
                    onDelete={() => setDeleteTarget(reply.id)}
                  />
                ))}
                {replyTo && isReplyingHere && (
                  <Composer
                    autoFocus
                    placeholder="Write a reply…"
                    onCancel={() => setReplyTo(null)}
                    onSubmit={body => {
                      createComment.mutate({ nodeId, parentPostId: post.id, body });
                      setReplyTo(null);
                    }}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}

      <DeleteConfirmationDialog
        open={deleteTarget != null}
        title="Delete comment?"
        message="This comment will be permanently deleted, along with any replies."
        confirmLabel="Delete comment"
        onConfirm={() => {
          if (deleteTarget) deleteComment.mutate(deleteTarget);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
