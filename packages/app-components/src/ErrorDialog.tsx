import { type ReactNode, useEffect } from 'react';
import { TbAlertTriangle } from 'react-icons/tb';
import { Dialog, KbdHints } from './Dialog';
import styles from './ErrorDialog.module.css';

export type ErrorDialogProps = {
  open: boolean;
  title: string;
  message: ReactNode;
  onClose: () => void;
};

export const ErrorDialog = ({ open, title, message, onClose }: ErrorDialogProps) => {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      onClose();
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      width={420}
      footerLeft={<KbdHints hints={[['Esc', 'close']]} />}
      buttons={[{ label: 'OK', type: 'default', onClick: onClose }]}
    >
      <div className={styles.cErrorDialog}>
        <div className={styles.eIcon}>
          <TbAlertTriangle size={16} />
        </div>
        <div className={styles.eTextBlock}>
          <p className={styles.eMessage}>{message}</p>
        </div>
      </div>
    </Dialog>
  );
};
