import { type ReactNode, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { TbMessage, TbMessageCirclePlus } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import type { ProjectFile } from '@arch-register/api-types/projectContract';
import {
  createTextAnchor,
  reanchorText,
  type TextAnchor
} from '@arch-register/api-types/textAnchor';
import { PlateMarkdownEditor } from './editor/PlateMarkdownEditor';
import { MdxPreview } from './preview/MdxPreview';
import { getSelectionBoundingRect, getSelectionPlainTextRange } from './preview/selectionOffsets';
import { MarkdownAttachmentManager } from './MarkdownAttachmentManager';
import { DiscussionThread } from '../discussions/DiscussionThread';
import { useDiscussions } from '../../hooks/useDiscussions';
import { useWikiComments } from '../../hooks/useWikiComments';
import { WikiInlineCommentsPanel } from '../wikiComments/WikiInlineCommentsPanel';
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
    propertiesPanel
  } = props;

  const { data: discussionPosts = [] } = useDiscussions(
    workspaceId,
    'content_node',
    nodeId,
    screenMode !== 'edit'
  );

  const isReadMode = screenMode !== 'edit';
  const { data: wikiComments = [] } = useWikiComments(workspaceId, nodeId, isReadMode);

  const previewRef = useRef<HTMLDivElement>(null);
  const [selectionRange, setSelectionRange] = useState<{
    start: number;
    end: number;
    rect: DOMRect;
  } | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [draftAnchor, setDraftAnchor] = useState<TextAnchor | null>(null);

  const rootComments = useMemo(() => wikiComments.filter(c => !c.parentPostId), [wikiComments]);

  // Kept in sync with the rendered preview DOM (not derived from the markdown AST directly),
  // since MdxPreview's DOM text-node content is what selection offsets are measured against.
  const [plainText, setPlainText] = useState('');
  // biome-ignore lint/correctness/useExhaustiveDependencies: body isn't read directly, but its change is what causes the preview DOM to update
  useLayoutEffect(() => {
    setPlainText(previewRef.current?.textContent ?? '');
  }, [body]);

  const highlightRanges = useMemo(() => {
    return rootComments
      .map(comment => {
        const result = reanchorText(plainText, comment.anchor);
        if (result.status === 'orphaned') return null;
        return { commentId: comment.id, start: result.start, end: result.end };
      })
      .filter((r): r is { commentId: string; start: number; end: number } => r !== null)
      .sort((a, b) => a.start - b.start);
  }, [rootComments, plainText]);

  const handleSelectionUp = useCallback(() => {
    const container = previewRef.current;
    if (!container) return;
    const range = getSelectionPlainTextRange(container);
    const rect = getSelectionBoundingRect();
    if (!range || !rect) {
      setSelectionRange(null);
      return;
    }
    setSelectionRange({ ...range, rect });
  }, []);

  const handleAddCommentClick = () => {
    if (!selectionRange) return;
    setDraftAnchor(createTextAnchor(plainText, selectionRange.start, selectionRange.end));
    setSelectionRange(null);
    window.getSelection()?.removeAllRanges();
  };

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
        {toc.length > 0 && (
          <aside className={styles.toc}>
            <div className={styles.tocLabel}>On this page</div>
            {toc.map((h, i) => (
              <div key={i} className={styles.tocItem}>
                {h}
              </div>
            ))}
          </aside>
        )}
      </div>
    );
  }

  return (
    <div className={styles.bodyGrid}>
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
                  onMarkClick: id => setActiveCommentId(id)
                }}
              />
            </div>
            {selectionRange && (
              <Button
                variant="primary"
                size="sm"
                className={styles.addCommentButton}
                style={{
                  left: selectionRange.rect.left + selectionRange.rect.width / 2,
                  top: selectionRange.rect.top
                }}
                onClick={handleAddCommentClick}
              >
                <TbMessageCirclePlus size={13} />
                Comment
              </Button>
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
            <section className={styles.wikiCommentsSection}>
              <div className={styles.wikiCommentsHead}>
                <TbMessageCirclePlus size={14} />
                <span className={styles.wikiCommentsTitle}>Inline comments</span>
                {rootComments.length > 0 && (
                  <span className={styles.discussionCount}>{rootComments.length}</span>
                )}
              </div>
              <WikiInlineCommentsPanel
                workspaceId={workspaceId}
                nodeId={nodeId}
                plainText={plainText}
                activeCommentId={activeCommentId}
                onActiveCommentChange={setActiveCommentId}
                draftAnchor={draftAnchor}
                onDraftHandled={() => setDraftAnchor(null)}
              />
            </section>
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
      {toc.length > 0 && (
        <aside className={styles.toc}>
          <div className={styles.tocLabel}>On this page</div>
          {toc.map((h, i) => (
            <div key={i} className={styles.tocItem}>
              {h}
            </div>
          ))}
        </aside>
      )}
    </div>
  );
};
