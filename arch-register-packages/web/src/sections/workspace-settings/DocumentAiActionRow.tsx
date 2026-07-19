import { TbTrash } from 'react-icons/tb';

import type { DocumentAiAction } from '@arch-register/api-types/documentContract';

import styles from './DocumentSettingsScreen.module.css';

export const DocumentAiActionRow = ({
  action,
  onEdit,
  onRemove
}: {
  action: DocumentAiAction;
  onEdit: () => void;
  onRemove: () => void;
}) => {
  return (
    <div className={styles.aiActionRow}>
      <button type="button" className={styles.aiActionName} onClick={onEdit}>
        {action.name || 'Unnamed action'}
      </button>
      <button type="button" className={styles.aiActionKind} onClick={onEdit}>
        {action.kind === 'interactive' ? 'Interactive' : 'Metadata generator'}
        {!action.enabled && <span className={styles.aiActionDisabled}>Disabled</span>}
      </button>
      <button type="button" className={styles.aiActionEdit} onClick={onEdit}>
        Edit
      </button>
      <button type="button" className={styles.iconBtn} onClick={onRemove}>
        <TbTrash size={13} />
      </button>
    </div>
  );
};

// =====================================================================
// Template editor
// =====================================================================
