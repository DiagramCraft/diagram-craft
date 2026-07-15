import { TbMessage } from 'react-icons/tb';
import type { ProjectFile } from '@arch-register/api-types/projectContract';
import { PlateMarkdownEditor } from './editor/PlateMarkdownEditor';
import { MdxPreview } from './preview/MdxPreview';
import { MarkdownAttachmentManager } from './MarkdownAttachmentManager';
import { DiscussionThread } from '../discussions/DiscussionThread';
import { useDiscussions } from '../../hooks/useDiscussions';
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
    showDiscussion = true
  } = props;

  const { data: discussionPosts = [] } = useDiscussions(
    workspaceId,
    'content_node',
    nodeId,
    screenMode !== 'edit'
  );

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
