import { TbDeviceFloppy, TbX } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import type { MarkdownPaneMode } from './MarkdownEditorScreen.state';
import styles from './MarkdownEditorScreen.module.css';

export const MarkdownEditorToolbar = (props: {
  paneMode: MarkdownPaneMode;
  hasUnsavedChanges: boolean;
  onSelectPane: (paneMode: MarkdownPaneMode) => void;
  onSave: () => void;
  onSaveAndClose: () => void;
  onClose: () => void;
}) => {
  const { paneMode, hasUnsavedChanges, onSelectPane, onSave, onSaveAndClose, onClose } = props;

  return (
    <div className={styles.toolbar}>
      <div className={styles.paneToggle}>
        <button
          type="button"
          className={`${styles.paneToggleBtn} ${paneMode === 'edit' ? styles.paneToggleBtnActive : ''}`}
          onClick={() => onSelectPane('edit')}
        >
          Edit
        </button>
        <button
          type="button"
          className={`${styles.paneToggleBtn} ${paneMode === 'raw' ? styles.paneToggleBtnActive : ''}`}
          onClick={() => onSelectPane('raw')}
        >
          Raw
        </button>
        <button
          type="button"
          className={`${styles.paneToggleBtn} ${paneMode === 'preview' ? styles.paneToggleBtnActive : ''}`}
          onClick={() => onSelectPane('preview')}
        >
          Preview
        </button>
      </div>

      <span className={hasUnsavedChanges ? styles.dirty : styles.clean}>
        {hasUnsavedChanges ? (
          <>
            <span className={styles.dirtyDot} /> Unsaved changes
          </>
        ) : (
          'All changes saved'
        )}
      </span>

      <div className={styles.toolbarActions}>
        <Button icon={<TbDeviceFloppy size={13} />} variant="secondary" onClick={onSave}>
          Save
        </Button>
        <Button icon={<TbDeviceFloppy size={13} />} variant="secondary" onClick={onSaveAndClose}>
          Save & Close
        </Button>
        <Button icon={<TbX size={13} />} variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
};
