import { Button } from '@diagram-craft/app-components/Button';
import styles from './ToolDialog.module.css';
import { ReactNode, useEffect, useLayoutEffect, useRef } from 'react';
import { usePortal } from '@diagram-craft/app-components/PortalContext';
import { useDialogContext } from '@diagram-craft/app-components/Dialog';
import { mustExist } from '@diagram-craft/utils/assert';
import { AlertDialog as BaseUIAlertDialog } from '@base-ui-components/react/alert-dialog';

type ToolDialogProps = {
  title: string;
  children: ReactNode | string;
  onOk: () => void;
  onCancel: () => void;
  open: boolean;
};

export const ToolDialog = ({ title, children, onOk, onCancel, open }: ToolDialogProps) => {
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
      onCancel();
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

  // TODO: This is a bit ugly
  useLayoutEffect(() => {
    queueMicrotask(() => {
      const toolDialogs = document.getElementsByClassName(styles.icToolDialog!);
      if (toolDialogs.length === 0) {
        return;
      }

      const toolDialog = toolDialogs[0] as HTMLDivElement;
      const toolbarElement = mustExist(document.querySelector('#toolbar > div'));
      toolDialog.style.left = `${toolbarElement!.getClientRects()[0]!.x - 8}px`;
      toolDialog.style.top = `${toolbarElement!.getClientRects()[0]!.y}px`;
      toolDialog.style.width = `${toolbarElement?.clientWidth + 8}px`;
      toolDialog.style.height = `${toolbarElement?.clientHeight - 0.5}px`;
    });
  });

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onOk();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOk]);

  return (
    <BaseUIAlertDialog.Root open={open} defaultOpen={open} onOpenChange={handleOpenChange}>
      <BaseUIAlertDialog.Portal container={portal}>
        <BaseUIAlertDialog.Viewport className={styles.icToolDialog}>
          <BaseUIAlertDialog.Popup initialFocus={false} className={styles.eContent}>
            <BaseUIAlertDialog.Title className={styles.eTitle}>{title}</BaseUIAlertDialog.Title>
            <BaseUIAlertDialog.Description
              render={<div className={styles.eDescription}>{children}</div>}
            />

            <Button style={{ marginLeft: 'auto' }} onClick={() => onOk()}>
              Ok
            </Button>
            <Button variant={'secondary'} onClick={() => onCancel()}>
              Cancel
            </Button>
          </BaseUIAlertDialog.Popup>
        </BaseUIAlertDialog.Viewport>
      </BaseUIAlertDialog.Portal>
    </BaseUIAlertDialog.Root>
  );
};
