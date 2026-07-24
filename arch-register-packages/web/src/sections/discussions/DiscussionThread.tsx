import { useMemo, useState } from 'react';
import { TbMessage, TbPencil, TbTrash } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import type {
  DiscussionObjectType,
  DiscussionPost
} from '@arch-register/api-types/discussionContract';
import { useAuth } from '../../auth/AuthContext';
import { MemberAvatar } from '../../components/MemberAvatar';
import {
  useCreateDiscussionPost,
  useDeleteDiscussionPost,
  useDiscussions,
  useUpdateDiscussionPost
} from '../../hooks/useDiscussions';
import styles from './DiscussionThread.module.css';
import { formatDateTime } from '../../utils/dateFormat';
import { EmptyState } from '../../components/EmptyState';

type ComposerProps = {
  placeholder: string;
  submitLabel?: string;
  autoFocus?: boolean;
  initialValue?: string;
  onSubmit: (body: string) => void;
  onCancel?: () => void;
  compact?: boolean;
};

const DiscussionComposer = ({
  placeholder,
  submitLabel = 'Post',
  autoFocus,
  initialValue = '',
  onSubmit,
  onCancel,
  compact
}: ComposerProps) => {
  const [value, setValue] = useState(initialValue);
  const trimmed = value.trim();

  return (
    <div className={compact ? styles.composerCompact : styles.composer}>
      <textarea
        className={styles.composerInput}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        rows={2}
        onChange={e => setValue(e.target.value)}
      />
      <div className={styles.composerRow}>
        <span className={styles.composerHint}>Visible to everyone with access to this page</span>
        <div className={styles.composerActions}>
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
    </div>
  );
};

type PostProps = {
  post: DiscussionPost;
  reply?: boolean;
  currentUserId: string | null;
  replying: boolean;
  onReply: () => void;
  onEdit: (body: string) => void;
  onDelete: () => void;
};

const DiscussionPostItem = ({
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
          <DiscussionComposer
            compact
            autoFocus
            initialValue={post.body}
            placeholder="Edit your post…"
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

export const DiscussionThread = ({
  workspaceId,
  objectType,
  objectId,
  showEmptyState = true
}: {
  workspaceId: string;
  objectType: DiscussionObjectType;
  objectId: string;
  /** Show the "No discussion yet" message when there are no posts. Defaults to true. */
  showEmptyState?: boolean;
}) => {
  const { user } = useAuth();
  const { data: posts = [], isLoading } = useDiscussions(workspaceId, objectType, objectId);
  const createPost = useCreateDiscussionPost(workspaceId, objectType, objectId);
  const updatePost = useUpdateDiscussionPost(workspaceId, objectType, objectId);
  const deletePost = useDeleteDiscussionPost(workspaceId, objectType, objectId);

  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const roots = useMemo(() => posts.filter(p => !p.parentPostId), [posts]);
  const repliesOf = (id: string) => posts.filter(p => p.parentPostId === id);

  if (isLoading) return null;

  return (
    <div className={styles.thread}>
      {posts.length === 0 && showEmptyState && (
        <EmptyState
          icon={<TbMessage size={18} />}
          title="No discussion yet"
          subtitle="Start a thread to capture questions or decisions."
        />
      )}

      {roots.map(post => {
        const replies = repliesOf(post.id);
        const isReplyingHere = replyTo === post.id || replies.some(r => r.id === replyTo);
        return (
          <div key={post.id} className={styles.root}>
            <DiscussionPostItem
              post={post}
              currentUserId={user?.id ?? null}
              replying={replyTo === post.id}
              onReply={() => setReplyTo(r => (r === post.id ? null : post.id))}
              onEdit={body => updatePost.mutate({ postId: post.id, body: { body } })}
              onDelete={() => setDeleteTarget(post.id)}
            />
            {(replies.length > 0 || isReplyingHere) && (
              <div className={styles.replies}>
                {replies.map(reply => (
                  <DiscussionPostItem
                    key={reply.id}
                    post={reply}
                    reply
                    currentUserId={user?.id ?? null}
                    replying={replyTo === reply.id}
                    onReply={() => setReplyTo(r => (r === reply.id ? null : reply.id))}
                    onEdit={body => updatePost.mutate({ postId: reply.id, body: { body } })}
                    onDelete={() => setDeleteTarget(reply.id)}
                  />
                ))}
                {replyTo && isReplyingHere && (
                  <DiscussionComposer
                    compact
                    autoFocus
                    placeholder="Write a reply…"
                    onCancel={() => setReplyTo(null)}
                    onSubmit={body => {
                      createPost.mutate({ objectType, objectId, parentPostId: post.id, body });
                      setReplyTo(null);
                    }}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}

      {roots.length > 0 ? (
        <div className={styles.newTopic}>
          <div className={styles.newTopicLabel}>New topic</div>
          <DiscussionComposer
            placeholder="Start a new topic…"
            onSubmit={body => createPost.mutate({ objectType, objectId, body })}
          />
        </div>
      ) : (
        <DiscussionComposer
          placeholder="Start a new topic…"
          onSubmit={body => createPost.mutate({ objectType, objectId, body })}
        />
      )}

      <DeleteConfirmationDialog
        open={deleteTarget != null}
        title="Delete post?"
        message="This post will be permanently deleted, along with any replies."
        confirmLabel="Delete post"
        onConfirm={() => {
          if (deleteTarget) deletePost.mutate(deleteTarget);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
