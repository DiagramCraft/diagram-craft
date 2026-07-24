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
import { AlertDialog as BaseUIAlertDialog } from '@base-ui/react/alert-dialog';

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
        className={styles.eButton}
        data-variant={'ghost'}
        disabled={props.disabled}
      >
        {props.label}
      </BaseUIAlertDialog.Close>
    );
  } else {
    return (
      <button
        type="button"
        className={styles.eButton}
        data-variant={props.type === 'default' ? 'primary' : props.type}
        onClick={props.onClick}
        disabled={props.disabled}
      >
        {props.label}
      </button>
    );
  }
};

export const Dialog = ({
  open,
  onClose,
  title,
  sup,
  sub,
  children,
  buttons = [],
  footerLeft,
  className,
  width
}: Props) => {
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
      onClose();
    }
  };

  // Handle initial mount with open=true
  useEffect(() => {
    if (open && !isOpenRef.current) {
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
  }, [open, dialogContext]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  return (
    <BaseUIAlertDialog.Root open={open} defaultOpen={open} onOpenChange={handleOpenChange}>
      <BaseUIAlertDialog.Portal container={portal}>
        <BaseUIAlertDialog.Backdrop className={styles.cDialogBackdrop} />
        <BaseUIAlertDialog.Viewport className={styles.cDialogViewport}>
          <BaseUIAlertDialog.Popup
            className={`${styles.cDialog}${className ? ` ${className}` : ''}`}
            style={width != null ? { width } : undefined}
            initialFocus={true}
          >
            <div className={styles.eHeader}>
              <div className={styles.eHeaderLeft}>
                {sup && <div className={styles.eSup}>{sup}</div>}
                <BaseUIAlertDialog.Title
                  className={styles.eTitle}
                  render={p => <div {...p}>{title}</div>}
                />
                {sub && <div className={styles.eSub}>{sub}</div>}
              </div>
            </div>

            <BaseUIAlertDialog.Description
              className={styles.eBody}
              render={p => <div {...p}>{children}</div>}
            />

            {(footerLeft || buttons.length > 0) && (
              <div className={styles.eFooter}>
                {footerLeft && <div className={styles.eFooterLeft}>{footerLeft}</div>}
                <div className={styles.eFooterRight}>
                  {buttons.map(btn => (
                    <DialogButton key={btn.label} {...btn} />
                  ))}
                </div>
              </div>
            )}
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
  sup?: string;
  sub?: ReactNode;
  children: ReactNode | string;
  buttons?: Button[];
  footerLeft?: ReactNode;
  className?: string;
  width?: string | number;
};

/** Renders a single key badge, e.g. <Kbd>Esc</Kbd> */
export const Kbd = ({ children }: { children: ReactNode }) => (
  <span className={styles.eKbd}>{children}</span>
);

/** Renders a row of keyboard hint pairs: [['Esc', 'cancel'], ['⌘↵', 'create']] */
export const KbdHints = ({ hints }: { hints: [key: string, label: string][] }) => (
  <>
    {hints.map(([key, label]) => (
      <span key={key}>
        <Kbd>{key}</Kbd> {label}
      </span>
    ))}
  </>
);

export type Button = {
  label: string;
  type: 'default' | 'secondary' | 'cancel' | 'danger';
  disabled?: boolean;
  onClick: MouseEventHandler<HTMLButtonElement>;
};
