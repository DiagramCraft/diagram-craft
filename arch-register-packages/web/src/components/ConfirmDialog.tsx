import { useEffect, useRef } from 'react';
import { TbTrash, TbInfoCircle } from 'react-icons/tb';
import { Dialog, KbdHints } from '@diagram-craft/app-components/Dialog';
import styles from './ConfirmDialog.module.css';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: React.ReactNode;
  detail?: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export const ConfirmDialog = ({
  open,
  title,
  message,
  detail,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => confirmRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
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
      <div className={styles.body}>
        <div className={styles.icon}>
          <TbTrash size={16} />
        </div>
        <div className={styles.textBlock}>
          <p className={styles.message}>{message}</p>
          {detail && (
            <div className={styles.detail}>
              <TbInfoCircle size={12} />
              {detail}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
};
