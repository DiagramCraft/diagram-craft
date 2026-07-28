import { Dialog } from '@diagram-craft/app-components/Dialog';
import styles from './MarkdownChangeImpactDialog.module.css';

export type MarkdownSaveIntent = 'save' | 'save-and-close';

export const MarkdownChangeImpactDialog = ({
  open,
  intent,
  changeKind,
  onChangeKind,
  onCancel,
  onConfirm
}: {
  open: boolean;
  intent: MarkdownSaveIntent | null;
  changeKind: 'minor' | 'major';
  onChangeKind: (changeKind: 'minor' | 'major') => void;
  onCancel: () => void;
  onConfirm: () => void;
}) => (
  <Dialog
    open={open}
    onClose={onCancel}
    title="Choose change impact"
    width={440}
    buttons={[
      { label: 'Cancel', type: 'cancel', onClick: onCancel },
      {
        label: intent === 'save-and-close' ? 'Save & Close' : 'Save',
        type: 'default',
        onClick: onConfirm
      }
    ]}
  >
    <div className={styles.body}>
      <p className={styles.description}>
        Choose how this change should affect the document workflow.
      </p>
      <label className={styles.field}>
        <span>Change impact</span>
        <select
          value={changeKind}
          onChange={event => onChangeKind(event.target.value as 'minor' | 'major')}
        >
          <option value="minor">Minor — preserve pending approval</option>
          <option value="major">Major — request target approval</option>
        </select>
      </label>
    </div>
  </Dialog>
);
