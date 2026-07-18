import { useEffect, useRef, useState } from 'react';
import { TbX } from 'react-icons/tb';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { useAuth } from '../../auth/AuthContext';
import {
  useCreateWikiComment,
  useDeleteWikiComment,
  useResolveWikiComment,
  useUpdateWikiComment,
  useWikiComments
} from '../../hooks/useWikiComments';
import { WikiCommentThreadCard } from './WikiCommentThreadCard';
import styles from './WikiInlineCommentsPopup.module.css';

/**
 * Floating single-thread popup used in the `inline` comments display mode: highlights stay in
 * the text, but the full thread only appears next to the highlight that was clicked.
 */
export const WikiInlineCommentsPopup = ({
  workspaceId,
  nodeId,
  commentId,
  anchorRect,
  plainText,
  onClose
}: {
  workspaceId: string;
  nodeId: string;
  commentId: string;
  anchorRect: DOMRect;
  plainText: string;
  onClose: () => void;
}) => {
  const { user } = useAuth();
  const { data: comments = [] } = useWikiComments(workspaceId, nodeId);
  const createComment = useCreateWikiComment(workspaceId, nodeId);
  const updateComment = useUpdateWikiComment(workspaceId, nodeId);
  const resolveComment = useResolveWikiComment(workspaceId, nodeId);
  const deleteComment = useDeleteWikiComment(workspaceId, nodeId);

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const post = comments.find(c => c.id === commentId);
  if (!post) return null;
  const replies = comments.filter(c => c.parentPostId === commentId);

  return (
    <>
      <div
        ref={popupRef}
        className={styles.popup}
        style={{
          top: anchorRect.bottom + 8,
          left: Math.max(8, Math.min(anchorRect.left, window.innerWidth - 288))
        }}
      >
        <button type="button" className={styles.closeBtn} title="Close" onClick={onClose}>
          <TbX size={13} />
        </button>
        <WikiCommentThreadCard
          className={styles.card}
          post={post}
          replies={replies}
          plainText={plainText}
          currentUserId={user?.id ?? null}
          active
          onReply={body => createComment.mutate({ nodeId, parentPostId: post.id, body })}
          onEdit={(postId, body) => updateComment.mutate({ postId, body: { body } })}
          onDelete={postId => setDeleteTarget(postId)}
          onResolve={() =>
            resolveComment.mutate({ postId: post.id, resolved: post.resolvedAt == null })
          }
        />
      </div>

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
    </>
  );
};
