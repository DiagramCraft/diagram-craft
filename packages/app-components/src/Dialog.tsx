import * as AlertDialog from '@radix-ui/react-alert-dialog';
import React, {
  createContext,
  useContext,
  MouseEventHandler,
  ReactNode,
  useEffect,
  useRef
} from 'react';
import { usePortal } from './PortalContext';
import { assert } from '@diagram-craft/utils/assert';
import styles from './Dialog.module.css';

type DialogContextType = {
  onDialogShow: () => void;
  onDialogHide: () => void;
};

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const useDialogContext = () => {
  const context = useContext(DialogContext);
  assert.present(context, 'Dialog must be used within a DialogProvider');
  return context;
};

type DialogProviderProps = {
  onDialogShow: () => void;
  onDialogHide: () => void;
  children: React.ReactNode;
};

export const DialogContextProvider = (props: DialogProviderProps) => {
  const contextValue = useRef<DialogContextType>({
    onDialogShow: props.onDialogShow,
    onDialogHide: props.onDialogHide
  });

  return (
    <DialogContext.Provider value={contextValue.current}>{props.children}</DialogContext.Provider>
  );
};

const DialogButton = (props: Button) => {
  if (props.type === 'cancel') {
    return (
      <AlertDialog.Cancel asChild>
        <button
          type="button"
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
          type="button"
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
  const dialogContext = useDialogContext();
  const isOpenRef = useRef(false);

  // Notify context when dialog opens/closes via onOpenChange
  const handleOpenChange = (open: boolean) => {
    const isOpen = isOpenRef.current;
    if (open && !isOpen) {
      dialogContext.onDialogShow();
      isOpenRef.current = true;
    } else if (!open && isOpen) {
      dialogContext.onDialogHide();
      isOpenRef.current = false;
      props.onClose();
    }
  };

  // Handle initial mount with open=true
  useEffect(() => {
    if (props.open && !isOpenRef.current) {
      dialogContext.onDialogShow();
      isOpenRef.current = true;
    }

    // Cleanup: if component unmounts while dialog is open
    return () => {
      if (isOpenRef.current) {
        dialogContext.onDialogHide();
        isOpenRef.current = false;
      }
    };
  }, [props.open, dialogContext]);

  return (
    <AlertDialog.Root open={props.open} defaultOpen={props.open} onOpenChange={handleOpenChange}>
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
