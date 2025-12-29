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

export const ToolDialog = (props: ToolDialogProps) => {
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
      props.onCancel();
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

  // TODO: This is a bit ugly
  useLayoutEffect(() => {
    queueMicrotask(() => {
      const toolDialogs = document.getElementsByClassName('toolDialog');
      if (toolDialogs.length === 0) {
        return;
      }

      const toolDialog = toolDialogs[0] as HTMLDivElement;
      const toolbarElement = mustExist(document.querySelector('#toolbar > .cmp-toolbar'));
      toolDialog.style.left = `${toolbarElement!.getClientRects()[0]!.x - 8}px`;
      toolDialog.style.top = `${toolbarElement!.getClientRects()[0]!.y}px`;
      toolDialog.style.width = `${toolbarElement?.clientWidth + 8}px`;
      toolDialog.style.height = `${toolbarElement?.clientHeight - 0.5}px`;
    });
  });

  useEffect(() => {
    if (!props.open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        props.onOk();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [props.open, props.onOk]);

  return (
    <BaseUIAlertDialog.Root
      open={props.open}
      defaultOpen={props.open}
      onOpenChange={handleOpenChange}
    >
      <BaseUIAlertDialog.Portal container={portal}>
        <BaseUIAlertDialog.Backdrop className={styles.cmpDialogOverlay} />
        <BaseUIAlertDialog.Viewport className={styles.toolDialog}>
          <BaseUIAlertDialog.Popup initialFocus={false} className={styles.toolDialogContent}>
            <BaseUIAlertDialog.Title className={styles.toolDialogTitle}>
              {props.title}
            </BaseUIAlertDialog.Title>
            <BaseUIAlertDialog.Description
              render={<div className={styles.toolDialogDescription}>{props.children}</div>}
            />

            <Button style={{ marginLeft: 'auto' }} onClick={() => props.onOk()}>
              Ok
            </Button>
            <Button type={'secondary'} onClick={() => props.onCancel()}>
              Cancel
            </Button>
          </BaseUIAlertDialog.Popup>
        </BaseUIAlertDialog.Viewport>
      </BaseUIAlertDialog.Portal>
    </BaseUIAlertDialog.Root>
  );
};
