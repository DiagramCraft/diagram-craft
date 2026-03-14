import React from 'react';
import { AlertDialog as BaseUIAlertDialog } from '@base-ui/react/alert-dialog';
import { Button } from '@diagram-craft/app-components/Button';
import { usePortal } from '@diagram-craft/app-components/PortalContext';
import styles from './MaximizedTextDialog.module.css';

type Props = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  contentClassName?: string;
  showCloseButton?: boolean;
};

export const MaximizedTextDialog = (props: Props) => {
  const portal = usePortal();
  const showCloseButton = props.showCloseButton ?? true;

  if (!props.open) {
    return null;
  }

  return (
    <BaseUIAlertDialog.Root open={true} defaultOpen={true} onOpenChange={props.onClose}>
      <BaseUIAlertDialog.Portal container={portal} className={styles.cMaximizedTextDialog}>
        <BaseUIAlertDialog.Viewport className={styles.eDialog}>
          <BaseUIAlertDialog.Popup initialFocus={true} className={styles.ePopup}>
            <BaseUIAlertDialog.Description
              className={
                props.contentClassName
                  ? `${styles.eContent} ${props.contentClassName}`
                  : styles.eContent
              }
              render={p => <div {...p}>{props.children}</div>}
            />

            {showCloseButton && (
              <div className={styles.eButtons}>
                <Button onClick={props.onClose}>Ok</Button>
              </div>
            )}
          </BaseUIAlertDialog.Popup>
        </BaseUIAlertDialog.Viewport>
      </BaseUIAlertDialog.Portal>
    </BaseUIAlertDialog.Root>
  );
};
