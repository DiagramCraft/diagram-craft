import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { MouseEventHandler, ReactNode } from 'react';
import { usePortal } from './PortalContext';
import styles from './Dialog.module.css';

const DialogButton = (props: Button) => {
  if (props.type === 'cancel') {
    return (
      <AlertDialog.Cancel asChild>
        <button
          className={`${styles.cmpDialogButton} ${styles.cmpDialogButtonSecondary}`}
          onClick={props.onClick}
        >
          {props.label}
        </button>
      </AlertDialog.Cancel>
    );
  } else {
    return (
      <AlertDialog.Action asChild>
        <button
          className={`${styles.cmpDialogButton} cmp-dialog__button--${props.type}`}
          onClick={props.onClick}
        >
          {props.label}
        </button>
      </AlertDialog.Action>
    );
  }
};

export const Dialog = (props: Props) => {
  const portal = usePortal();
  return (
    <AlertDialog.Root
      open={props.open}
      defaultOpen={props.open}
      onOpenChange={open => {
        if (!open) {
          props.onClose();
        }
      }}
    >
      <AlertDialog.Portal container={portal}>
        <div className={styles.cmpDialog}>
          <AlertDialog.Overlay className={styles.cmpDialogOverlay} />
          <AlertDialog.Content
            className={styles.cmpDialogContent}
            onOpenAutoFocus={e => e.preventDefault()}
          >
            <AlertDialog.Title className={styles.cmpDialogTitle}>{props.title}</AlertDialog.Title>
            <AlertDialog.Description asChild>
              <div className={styles.cmpDialogDescription}>{props.children}</div>
            </AlertDialog.Description>

            <div style={{ display: 'flex', gap: 25, justifyContent: 'flex-end' }}>
              {props.buttons.map(btn => (
                <DialogButton key={btn.label} {...btn} />
              ))}
            </div>
          </AlertDialog.Content>
        </div>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode | string;
  buttons: Button[];
};

export type Button = {
  label: string;
  type: 'default' | 'secondary' | 'cancel' | 'danger';
  onClick: MouseEventHandler<HTMLButtonElement>;
};
