import type { ProjectFile, MarkdownRevisionSummary } from '@arch-register/api-types/projectContract';
import { PlateMarkdownEditor } from './editor/PlateMarkdownEditor';
import { MdxPreview } from './preview/MdxPreview';
import { MarkdownHistoryPanel } from './MarkdownHistoryPanel';
import { MarkdownAttachmentManager } from './MarkdownAttachmentManager';
import type { MarkdownEditorScreenState } from './MarkdownEditorScreen.state';
import styles from './MarkdownEditorScreen.module.css';

export const MarkdownEditorPane = (props: {
  screenState: MarkdownEditorScreenState;
  body: string;
  onChange: (value: string) => void;
  toc: string[];
  attachments: ProjectFile[];
  updatedLabel: string | null;
  readTime: number;
  onOpenAttachment: (attachment: ProjectFile) => void;
  onDeleteAttachmentRequest: (attachment: ProjectFile) => void;
  isDeletingAttachment: boolean;
  workspaceSlug: string;
  nodeId: string;
  revisions: MarkdownRevisionSummary[];
  revisionsLoading: boolean;
  selectedRevisionId: string | undefined;
  historyMode: 'preview' | 'compare';
  compareMode: 'to-current' | 'changes-in-version';
  isRestoring: boolean;
  onSelectRevision: (revisionId: string) => void;
  onViewVersion: () => void;
  onEnterCompare: (mode: 'to-current' | 'changes-in-version') => void;
  onRestore: (revisionId: string) => void;
  onClosePreview: () => void;
}) => {
  const {
    screenState,
    body,
    onChange,
    toc,
    attachments,
    updatedLabel,
    readTime,
    onOpenAttachment,
    onDeleteAttachmentRequest,
    isDeletingAttachment,
    workspaceSlug,
    nodeId,
    revisions,
    revisionsLoading,
    selectedRevisionId,
    historyMode,
    compareMode,
    isRestoring,
    onSelectRevision,
    onViewVersion,
    onEnterCompare,
    onRestore,
    onClosePreview
  } = props;

  const showPlateEditor = screenState.screenMode === 'edit' && screenState.paneMode === 'edit';
  const showRawEditor = screenState.screenMode === 'edit' && screenState.paneMode === 'raw';

  if (showPlateEditor) {
    return <PlateMarkdownEditor value={body} onChange={onChange} />;
  }

  if (showRawEditor) {
    return (
      <div className={styles.editPane}>
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

  if (screenState.screenMode === 'edit') {
    return (
      <div className={styles.bodyGrid}>
        <article className={styles.article}>
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

  if (screenState.viewPanel === 'history') {
    return (
      <MarkdownHistoryPanel
        workspaceSlug={workspaceSlug}
        nodeId={nodeId}
        currentBody={body}
        revisions={revisions}
        revisionsLoading={revisionsLoading}
        selectedRevisionId={selectedRevisionId}
        historyMode={historyMode}
        compareMode={compareMode}
        isRestoring={isRestoring}
        onSelectRevision={onSelectRevision}
        onViewVersion={onViewVersion}
        onEnterCompare={onEnterCompare}
        onRestore={onRestore}
        onClose={onClosePreview}
      />
    );
  }

  return (
    <div className={styles.bodyGrid}>
      <article className={styles.article}>
        {body.trim() ? (
          <>
            <MdxPreview body={body} withoutFirstHeading />
            <MarkdownAttachmentManager
              attachments={attachments}
              onOpen={onOpenAttachment}
              onDeleteRequest={onDeleteAttachmentRequest}
              isDeleting={isDeletingAttachment}
            />
            <div className={styles.articleFooter}>
              {updatedLabel && <>Last edited {updatedLabel} · </>}
              {readTime} min read
            </div>
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
