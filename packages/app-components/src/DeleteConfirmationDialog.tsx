import { type ReactNode, useEffect } from 'react';
import { TbInfoCircle, TbTrash } from 'react-icons/tb';
import { Dialog, KbdHints } from './Dialog';
import styles from './DeleteConfirmationDialog.module.css';

export type DeleteConfirmationDialogProps = {
  open: boolean;
  title: string;
  message: ReactNode;
  detail?: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export const DeleteConfirmationDialog = ({
  open,
  title,
  message,
  detail,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel
}: DeleteConfirmationDialogProps) => {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      onConfirm();
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, onConfirm]);

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      width={420}
      footerLeft={<KbdHints hints={[['Esc', 'cancel']]} />}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onCancel },
        { label: confirmLabel, type: 'danger', onClick: onConfirm }
      ]}
    >
      <div className={styles.cDeleteConfirmationDialog}>
        <div className={styles.eIcon}>
          <TbTrash size={16} />
        </div>
        <div className={styles.eTextBlock}>
          <p className={styles.eMessage}>{message}</p>
          {detail && (
            <div className={styles.eDetail}>
              <TbInfoCircle size={12} />
              <span>{detail}</span>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
};
