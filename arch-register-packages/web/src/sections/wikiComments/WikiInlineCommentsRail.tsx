import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { TbMessageCircle } from 'react-icons/tb';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { useAuth } from '../../auth/AuthContext';
import {
  useCreateWikiComment,
  useDeleteWikiComment,
  useResolveWikiComment,
  useUpdateWikiComment,
  useWikiComments
} from '../../hooks/useWikiComments';
import { EmptyState } from '../../components/EmptyState';
import { WikiCommentThreadCard } from './WikiCommentThreadCard';
import styles from './WikiInlineCommentsRail.module.css';

const CARD_GAP = 12;
const FALLBACK_CARD_HEIGHT = 110;

/**
 * Right-margin rail of comment cards, aligned to their `<mark data-comment-id>` highlights in
 * `articleRef`. Word-style review layout: each thread's card top is pinned to its highlight's
 * position, then nudged down to avoid overlapping the previous card.
 */
export const WikiInlineCommentsRail = ({
  workspaceId,
  nodeId,
  articleRef,
  plainText,
  activeCommentId,
  onActiveCommentChange
}: {
  workspaceId: string;
  nodeId: string;
  articleRef: RefObject<HTMLElement | null>;
  /** Current rendered plain text of the page, used to detect stale anchors. */
  plainText: string;
  activeCommentId: string | null;
  onActiveCommentChange: (id: string | null) => void;
}) => {
  const { user } = useAuth();
  const { data: comments = [], isLoading } = useWikiComments(workspaceId, nodeId);
  const createComment = useCreateWikiComment(workspaceId, nodeId);
  const updateComment = useUpdateWikiComment(workspaceId, nodeId);
  const resolveComment = useResolveWikiComment(workspaceId, nodeId);
  const deleteComment = useDeleteWikiComment(workspaceId, nodeId);

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const railRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const lastPositionsRef = useRef<Record<string, number>>({});
  const [positions, setPositions] = useState<Record<string, number>>({});

  const roots = useMemo(() => comments.filter(c => !c.parentPostId), [comments]);
  const repliesOf = (id: string) => comments.filter(c => c.parentPostId === id);

  const recompute = useCallback(() => {
    const container = articleRef.current;
    const rail = railRef.current;
    if (!container || !rail) return;
    const railRect = rail.getBoundingClientRect();

    // Comments whose anchor no longer resolves to a mark (deleted/edited-away text) have no
    // natural top -- they fall through to `null` and get stacked directly below whatever
    // precedes them, so they stay visible instead of disappearing.
    const items = roots
      .map(post => {
        const mark = container.querySelector<HTMLElement>(`mark[data-comment-id="${post.id}"]`);
        return { id: post.id, top: mark ? mark.getBoundingClientRect().top - railRect.top : null };
      })
      .sort((a, b) => (a.top ?? Infinity) - (b.top ?? Infinity));

    let cursor = 0;
    const next: Record<string, number> = {};
    for (const item of items) {
      const top = Math.max(item.top ?? cursor, cursor);
      next[item.id] = top;
      cursor =
        top + (cardRefs.current.get(item.id)?.offsetHeight ?? FALLBACK_CARD_HEIGHT) + CARD_GAP;
    }

    const prev = lastPositionsRef.current;
    const changed =
      Object.keys(prev).length !== Object.keys(next).length ||
      Object.entries(next).some(([id, top]) => Math.abs((prev[id] ?? -1) - top) > 0.5);
    if (changed) {
      lastPositionsRef.current = next;
      setPositions(next);
    }
  }, [articleRef, roots]);

  useLayoutEffect(() => {
    recompute();
  });

  useEffect(() => {
    window.addEventListener('resize', recompute);
    return () => window.removeEventListener('resize', recompute);
  }, [recompute]);

  useEffect(() => {
    if (!activeCommentId) return;
    articleRef.current
      ?.querySelector<HTMLElement>(`mark[data-comment-id="${activeCommentId}"]`)
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeCommentId, articleRef]);

  if (isLoading) return null;

  return (
    <div className={styles.rail} ref={railRef}>
      {roots.length === 0 && (
        <EmptyState
          icon={<TbMessageCircle size={18} />}
          title="No inline comments yet"
          subtitle="Select text in the page to leave a comment on it."
        />
      )}

      {roots.map(post => (
        <div key={post.id} className={styles.cardWrap} style={{ top: positions[post.id] ?? 0 }}>
          <WikiCommentThreadCard
            post={post}
            replies={repliesOf(post.id)}
            plainText={plainText}
            currentUserId={user?.id ?? null}
            active={post.id === activeCommentId}
            onQuoteClick={() => onActiveCommentChange(post.id)}
            cardRef={el => {
              if (el) cardRefs.current.set(post.id, el);
              else cardRefs.current.delete(post.id);
            }}
            onReply={body => createComment.mutate({ nodeId, parentPostId: post.id, body })}
            onEdit={(postId, body) => updateComment.mutate({ postId, body: { body } })}
            onDelete={postId => setDeleteTarget(postId)}
            onResolve={() =>
              resolveComment.mutate({ postId: post.id, resolved: post.resolvedAt == null })
            }
          />
        </div>
      ))}

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
