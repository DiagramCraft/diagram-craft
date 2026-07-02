import type { ProjectFile } from '@arch-register/api-types/projectContract';
import { PlateMarkdownEditor } from './editor/PlateMarkdownEditor';
import { MdxPreview } from './preview/MdxPreview';
import { MarkdownAttachmentManager } from './MarkdownAttachmentManager';
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
}) => {
  const { screenMode, paneMode, body, onChange, toc, updatedLabel, readTime, attachments } = props;

  const showPlateEditor = screenMode === 'edit' && paneMode === 'edit';
  const showRawEditor = screenMode === 'edit' && paneMode === 'raw';

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

  if (screenMode === 'edit') {
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

  return (
    <div className={styles.bodyGrid}>
      <article className={styles.article}>
        {body.trim() ? (
          <>
            <MdxPreview body={body} withoutFirstHeading />
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
