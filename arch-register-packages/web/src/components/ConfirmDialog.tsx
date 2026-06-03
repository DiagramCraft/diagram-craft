import { useEffect, useRef } from 'react';
import { TbTrash, TbInfoCircle } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Dialog } from './Dialog';
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
    <Dialog open={open} onClose={onCancel} title="" panelClassName={styles.panel}>
      <div className={styles.body}>
        <div className={styles.icon}>
          <TbTrash size={16} />
        </div>
        <div className={styles.textBlock}>
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.message}>{message}</p>
          {detail && (
            <div className={styles.detail}>
              <TbInfoCircle size={12} />
              {detail}
            </div>
          )}
        </div>
      </div>
      <div className={styles.footer}>
        <div className={styles.footerHint}>
          <span>
            <span className={styles.kbd}>Esc</span> to cancel
          </span>
        </div>
        <div className={styles.footerActions}>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger-solid" ref={confirmRef} icon={<TbTrash size={11} />} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
