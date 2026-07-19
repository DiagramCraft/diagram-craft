import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { TbMessage, TbMessageCirclePlus, TbSparkles } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import type { ProjectFile } from '@arch-register/api-types/projectContract';
import type { DocumentAiAction } from '@arch-register/api-types/documentContract';
import { createTextAnchor, reanchorText } from '@arch-register/api-types/textAnchor';
import { PlateMarkdownEditor } from './editor/PlateMarkdownEditor';
import { MdxPreview } from './preview/MdxPreview';
import { getSelectionBoundingRect, getSelectionPlainTextRange } from './preview/selectionOffsets';
import { MarkdownAttachmentManager } from './MarkdownAttachmentManager';
import { DiscussionThread } from '../discussions/DiscussionThread';
import { useDiscussions } from '../../hooks/useDiscussions';
import { useCreateWikiComment, useWikiComments } from '../../hooks/useWikiComments';
import { WikiInlineCommentsRail } from '../wikiComments/WikiInlineCommentsRail';
import { WikiInlineCommentsPopup } from '../wikiComments/WikiInlineCommentsPopup';
import { Composer } from '../wikiComments/WikiCommentComposer';
import type { CommentsDisplayMode } from '../wikiComments/commentsDisplayMode';
import { DocumentBacklinksSection } from './DocumentBacklinksSection';
import type { MarkdownPaneMode, MarkdownScreenMode } from './MarkdownEditorScreen.state';
import styles from './MarkdownEditorScreen.module.css';

type MarkdownEditorPaneAttachments = {
  items: ProjectFile[];
  onOpen: (attachment: ProjectFile) => void;
  onDeleteRequest: (attachment: ProjectFile) => void;
  isDeleting: boolean;
};

// Rendered whenever the screen isn't showing the history panel (see MarkdownEditorScreen).
export const MarkdownEditorPane = (props: {
  screenMode: MarkdownScreenMode;
  paneMode: MarkdownPaneMode;
  body: string;
  onChange: (value: string) => void;
  toc: string[];
  updatedLabel: string | null;
  readTime: number;
  attachments: MarkdownEditorPaneAttachments;
  workspaceId: string;
  nodeId: string;
  showDiscussion?: boolean;
  showBacklinks?: boolean;
  propertiesPanel?: ReactNode;
  commentsMode: CommentsDisplayMode;
  aiActions?: DocumentAiAction[];
  runningAiActionId?: string | null;
  onRunAiAction?: (action: DocumentAiAction) => void;
}) => {
  const {
    screenMode,
    paneMode,
    body,
    onChange,
    toc,
    updatedLabel,
    readTime,
    attachments,
    workspaceId,
    nodeId,
    showDiscussion = true,
    showBacklinks = true,
    propertiesPanel,
    commentsMode,
    aiActions = [],
    runningAiActionId = null,
    onRunAiAction
  } = props;

  const { data: discussionPosts = [] } = useDiscussions(
    workspaceId,
    'content_node',
    nodeId,
    screenMode !== 'edit'
  );

  const isReadMode = screenMode !== 'edit';
  const { data: wikiComments = [] } = useWikiComments(workspaceId, nodeId, isReadMode);
  const createComment = useCreateWikiComment(workspaceId, nodeId);

  const previewRef = useRef<HTMLDivElement>(null);
  const [selectionRange, setSelectionRange] = useState<{
    start: number;
    end: number;
    rect: DOMRect;
  } | null>(null);
  const [commentComposerOpen, setCommentComposerOpen] = useState(false);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [inlinePopupRect, setInlinePopupRect] = useState<DOMRect | null>(null);

  const rootComments = useMemo(() => wikiComments.filter(c => !c.parentPostId), [wikiComments]);

  // Switching display mode invalidates whatever was focused under the previous mode (a rail
  // scroll target, an open popup) -- drop both rather than let them carry over stale.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only commentsMode should retrigger this
  useEffect(() => {
    setActiveCommentId(null);
    setInlinePopupRect(null);
  }, [commentsMode]);

  // Kept in sync with the rendered preview DOM (not derived from the markdown AST directly),
  // since MdxPreview's DOM text-node content is what selection offsets are measured against.
  const [plainText, setPlainText] = useState('');
  // biome-ignore lint/correctness/useExhaustiveDependencies: body isn't read directly, but its change is what causes the preview DOM to update
  useLayoutEffect(() => {
    setPlainText(previewRef.current?.textContent ?? '');
  }, [body]);

  const highlightRanges = useMemo(() => {
    if (commentsMode === 'off') return [];
    return rootComments
      .map(comment => {
        const result = reanchorText(plainText, comment.anchor);
        if (result.status === 'orphaned') return null;
        return {
          commentId: comment.id,
          start: result.start,
          end: result.end,
          resolved: comment.resolvedAt != null
        };
      })
      .filter(
        (r): r is { commentId: string; start: number; end: number; resolved: boolean } => r !== null
      )
      .sort((a, b) => a.start - b.start);
  }, [rootComments, plainText, commentsMode]);

  const handleMarkClick = useCallback(
    (id: string) => {
      setActiveCommentId(id);
      if (commentsMode === 'inline') {
        const markEl = previewRef.current?.querySelector<HTMLElement>(
          `mark[data-comment-id="${id}"]`
        );
        setInlinePopupRect(markEl?.getBoundingClientRect() ?? null);
      }
    },
    [commentsMode]
  );

  const clearSelection = useCallback(() => {
    setSelectionRange(null);
    setCommentComposerOpen(false);
    window.getSelection()?.removeAllRanges();
  }, []);

  const handleSelectionUp = useCallback(() => {
    const container = previewRef.current;
    if (!container) return;
    const range = getSelectionPlainTextRange(container);
    const rect = getSelectionBoundingRect();
    if (!range || !rect) {
      setSelectionRange(null);
      setCommentComposerOpen(false);
      return;
    }
    setSelectionRange({ ...range, rect });
    setCommentComposerOpen(false);
  }, []);

  const submitSelectionComment = (text: string) => {
    if (!selectionRange) return;
    const anchor = createTextAnchor(plainText, selectionRange.start, selectionRange.end);
    createComment.mutate({ nodeId, body: text, anchor });
    clearSelection();
  };

  const enabledAiActions = aiActions.filter(
    action => action.enabled && action.kind === 'interactive'
  );

  const aiActionsSection = enabledAiActions.length > 0 && (
    <div className={styles.aiActionsSection}>
      <div className={styles.aiActionsLabel}>AI actions</div>
      <div className={styles.aiActionsList}>
        {enabledAiActions.map(action => (
          <Button
            key={action.id}
            variant="ghost"
            size="sm"
            className={styles.aiActionButton}
            icon={<TbSparkles size={13} />}
            disabled={runningAiActionId !== null}
            onClick={() => onRunAiAction?.(action)}
          >
            {runningAiActionId === action.id ? 'Running…' : action.name}
          </Button>
        ))}
      </div>
    </div>
  );

  const showPlateEditor = screenMode === 'edit' && paneMode === 'edit';
  const showRawEditor = screenMode === 'edit' && paneMode === 'raw';

  if (showPlateEditor) {
    return (
      <div className={styles.editPane}>
        {propertiesPanel && <div className={styles.paneProperties}>{propertiesPanel}</div>}
        <PlateMarkdownEditor value={body} onChange={onChange} />
      </div>
    );
  }

  if (showRawEditor) {
    return (
      <div className={styles.editPane}>
        {propertiesPanel && <div className={styles.paneProperties}>{propertiesPanel}</div>}
        <textarea
          className={styles.textarea}
          value={body}
          onChange={e => onChange(e.target.value)}
          placeholder="Start writing in Markdown…"
          spellCheck
        />
      </div>
    );
  }

  if (screenMode === 'edit') {
    return (
      <div className={styles.bodyGrid}>
        <article className={styles.article}>
          {propertiesPanel}
          {body.trim() ? (
            <MdxPreview body={body} withoutFirstHeading />
          ) : (
            <div className={styles.previewEmpty}>Nothing to preview yet.</div>
          )}
        </article>
        {(toc.length > 0 || enabledAiActions.length > 0) && (
          <aside className={styles.toc}>
            {toc.length > 0 && (
              <>
                <div className={styles.tocLabel}>On this page</div>
                {toc.map((h, i) => (
                  <div key={i} className={styles.tocItem}>
                    {h}
                  </div>
                ))}
              </>
            )}
            {aiActionsSection}
          </aside>
        )}
      </div>
    );
  }

  const commentsEnabled = isReadMode && commentsMode !== 'off' && body.trim().length > 0;
  const showCommentsRail = commentsEnabled && commentsMode === 'side' && rootComments.length > 0;
  const gridClassName = showCommentsRail
    ? `${styles.bodyGrid} ${styles.bodyGridWithComments}`
    : styles.bodyGrid;
  const selectionQuote = selectionRange
    ? plainText.slice(selectionRange.start, selectionRange.end)
    : '';

  return (
    <div className={gridClassName}>
      <article className={styles.article}>
        {propertiesPanel}
        {body.trim() ? (
          <>
            <div ref={previewRef} className={styles.previewContainer} onMouseUp={handleSelectionUp}>
              <MdxPreview
                body={body}
                withoutFirstHeading
                highlightRanges={highlightRanges}
                highlightHandlers={{
                  activeCommentId,
                  onMarkClick: handleMarkClick
                }}
              />
            </div>
            {commentsEnabled && selectionRange && !commentComposerOpen && (
              <Button
                variant="primary"
                size="sm"
                className={styles.addCommentButton}
                style={{
                  left: selectionRange.rect.left + selectionRange.rect.width / 2,
                  top: selectionRange.rect.top
                }}
                onClick={() => setCommentComposerOpen(true)}
              >
                <TbMessageCirclePlus size={13} />
                Comment
              </Button>
            )}
            {commentsEnabled && selectionRange && commentComposerOpen && (
              <div
                className={styles.commentComposerFloat}
                style={{
                  top: selectionRange.rect.bottom + 8,
                  left: Math.max(8, Math.min(selectionRange.rect.left, window.innerWidth - 288))
                }}
              >
                <div className={styles.commentComposerQuote}>
                  &ldquo;
                  {selectionQuote.length > 90 ? `${selectionQuote.slice(0, 90)}…` : selectionQuote}
                  &rdquo;
                </div>
                <Composer
                  autoFocus
                  placeholder="Add a comment…"
                  onCancel={clearSelection}
                  onSubmit={submitSelectionComment}
                />
              </div>
            )}
            <MarkdownAttachmentManager
              attachments={attachments.items}
              onOpen={attachments.onOpen}
              onDeleteRequest={attachments.onDeleteRequest}
              isDeleting={attachments.isDeleting}
            />
            <div className={styles.articleFooter}>
              {updatedLabel && <>Last edited {updatedLabel} · </>}
              {readTime} min read
            </div>
            {showBacklinks && (
              <DocumentBacklinksSection workspaceId={workspaceId} nodeId={nodeId} />
            )}
            {showDiscussion && (
              <section className={styles.discussionSection}>
                <div className={styles.discussionHead}>
                  <TbMessage size={14} />
                  <span className={styles.discussionTitle}>Discussion</span>
                  {discussionPosts.length > 0 && (
                    <span className={styles.discussionCount}>{discussionPosts.length}</span>
                  )}
                </div>
                <DiscussionThread
                  workspaceId={workspaceId}
                  objectType="content_node"
                  objectId={nodeId}
                  showEmptyState={false}
                />
              </section>
            )}
          </>
        ) : (
          <div className={styles.previewEmpty}>Preview will appear here as you type.</div>
        )}
      </article>
      {showCommentsRail && (
        <WikiInlineCommentsRail
          workspaceId={workspaceId}
          nodeId={nodeId}
          articleRef={previewRef}
          plainText={plainText}
          activeCommentId={activeCommentId}
          onActiveCommentChange={setActiveCommentId}
        />
      )}
      {commentsEnabled && commentsMode === 'inline' && activeCommentId && inlinePopupRect && (
        <WikiInlineCommentsPopup
          workspaceId={workspaceId}
          nodeId={nodeId}
          commentId={activeCommentId}
          anchorRect={inlinePopupRect}
          plainText={plainText}
          onClose={() => {
            setActiveCommentId(null);
            setInlinePopupRect(null);
          }}
        />
      )}
      {(toc.length > 0 || enabledAiActions.length > 0) && (
        <aside className={styles.toc}>
          {toc.length > 0 && (
            <>
              <div className={styles.tocLabel}>On this page</div>
              {toc.map((h, i) => (
                <div key={i} className={styles.tocItem}>
                  {h}
                </div>
              ))}
            </>
          )}
          {aiActionsSection}
        </aside>
      )}
    </div>
  );
};
