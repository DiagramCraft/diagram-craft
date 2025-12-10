import { Button } from '@diagram-craft/app-components/Button';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import styles from './ToolDialog.module.css';
import { ReactNode, useEffect, useRef } from 'react';
import { usePortal } from '@diagram-craft/app-components/PortalContext';
import { useDialogContext } from '@diagram-craft/app-components/Dialog';
import { mustExist } from '@diagram-craft/utils/assert';

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
  const dialogRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!dialogRef.current) return;

    const toolbarElement = mustExist(document.querySelector('#toolbar > .cmp-toolbar'));
    dialogRef.current.style.left = toolbarElement?.getClientRects()[0]!.x - 8 + 'px';
    dialogRef.current.style.top = toolbarElement?.getClientRects()[0]!.y + 'px';
    dialogRef.current.style.width = toolbarElement?.clientWidth + 8 + 'px';
    dialogRef.current.style.height = toolbarElement?.clientHeight - 0.5 + 'px';
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
    <AlertDialog.Root open={props.open} defaultOpen={props.open} onOpenChange={handleOpenChange}>
      <AlertDialog.Portal container={portal}>
        <div className={styles.toolDialog} ref={dialogRef}>
          <AlertDialog.Overlay className={styles.cmpDialogOverlay} />
          <AlertDialog.Content
            className={styles.toolDialogContent}
            onOpenAutoFocus={e => e.preventDefault()}
          >
            <AlertDialog.Title className={styles.toolDialogTitle}>{props.title}</AlertDialog.Title>
            <AlertDialog.Description asChild>
              <div className={styles.toolDialogDescription}>{props.children}</div>
            </AlertDialog.Description>

            <Button style={{ marginLeft: 'auto' }} onClick={() => props.onOk()}>
              Ok
            </Button>
            <Button type={'secondary'} onClick={() => props.onCancel()}>
              Cancel
            </Button>
          </AlertDialog.Content>
        </div>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};
