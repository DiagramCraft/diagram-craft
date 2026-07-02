import { TbTrash } from 'react-icons/tb';
import type { ProjectFile } from '@arch-register/api-types/projectContract';
import { getFileNodeIcon } from '../../lib/contentNode';
import styles from './MarkdownEditorScreen.module.css';

export const MarkdownAttachmentManager = (props: {
  attachments: ProjectFile[];
  onOpen: (attachment: ProjectFile) => void;
  onDeleteRequest: (attachment: ProjectFile) => void;
  isDeleting: boolean;
}) => {
  const { attachments, onOpen, onDeleteRequest, isDeleting } = props;

  if (attachments.length === 0) return null;

  return (
    <section className={styles.attachmentsSection}>
      <div className={styles.attachmentsHeader}>
        <h2 className={styles.attachmentsTitle}>Attachments</h2>
        <span className={styles.attachmentsCount}>
          {attachments.length} {attachments.length === 1 ? 'item' : 'items'}
        </span>
      </div>
      <div className={styles.attachmentsList}>
        {attachments.map(attachment => (
          <div key={attachment.id} className={styles.attachmentItem}>
            <button
              type="button"
              className={styles.attachmentMain}
              onClick={() => onOpen(attachment)}
            >
              <span className={styles.attachmentIcon}>
                {getFileNodeIcon(attachment.type, 14)}
              </span>
              <span className={styles.attachmentBody}>
                <span className={styles.attachmentName}>
                  {attachment.original_filename ?? attachment.name}
                </span>
                <span className={styles.attachmentMeta}>
                  {attachment.type === 'diagram'
                    ? 'Diagram'
                    : attachment.type === 'markdown'
                      ? 'Wiki page'
                      : (attachment.mime_type ?? 'File')}
                </span>
              </span>
            </button>
            <button
              type="button"
              className={styles.attachmentDelete}
              onClick={event => {
                event.stopPropagation();
                onDeleteRequest(attachment);
              }}
              aria-label={`Delete ${attachment.original_filename ?? attachment.name}`}
              disabled={isDeleting}
            >
              <TbTrash size={14} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
};
