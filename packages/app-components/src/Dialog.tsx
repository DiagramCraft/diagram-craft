import React, {
  createContext,
  MouseEventHandler,
  ReactNode,
  useContext,
  useEffect,
  useRef
} from 'react';
import { usePortal } from './PortalContext';
import { assert } from '@diagram-craft/utils/assert';
import styles from './Dialog.module.css';
import { AlertDialog as BaseUIAlertDialog } from '@base-ui-components/react/alert-dialog';

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
      <BaseUIAlertDialog.Close
        className={`${styles.cmpDialogButton} ${styles.cmpDialogButtonSecondary}`}
      >
        {props.label}
      </BaseUIAlertDialog.Close>
    );
  } else {
    return (
      <button
        type="button"
        className={`${styles.cmpDialogButton} cmp-dialog__button--${props.type}`}
        onClick={props.onClick}
      >
        {props.label}
      </button>
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

  useEffect(() => {
    if (!props.open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        props.onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [props.open, props.onClose]);

  return (
    <BaseUIAlertDialog.Root
      open={props.open}
      defaultOpen={props.open}
      onOpenChange={handleOpenChange}
    >
      <BaseUIAlertDialog.Portal container={portal}>
        <BaseUIAlertDialog.Backdrop className={styles.cmpDialogOverlay} />
        <BaseUIAlertDialog.Viewport className={styles.cmpDialogContent}>
          <BaseUIAlertDialog.Popup initialFocus={true}>
            <BaseUIAlertDialog.Title
              className={styles.cmpDialogTitle}
              render={p => <div {...p}>{props.title}</div>}
            />
            <BaseUIAlertDialog.Description
              className={styles.cmpDialogDescription}
              render={p => <div {...p}>{props.children}</div>}
            />

            <div style={{ display: 'flex', gap: 25, justifyContent: 'flex-end' }}>
              {props.buttons.map(btn => (
                <DialogButton key={btn.label} {...btn} />
              ))}
            </div>
          </BaseUIAlertDialog.Popup>
        </BaseUIAlertDialog.Viewport>
      </BaseUIAlertDialog.Portal>
    </BaseUIAlertDialog.Root>
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
