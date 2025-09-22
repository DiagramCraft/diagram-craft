import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { usePortal } from '@diagram-craft/app-components/PortalContext';
import styles from './ModelCenterDialog.module.css';
import { TbX } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';

type Props = {
  open: boolean;
  onClose: () => void;
};

export const ModelCenterDialog = (props: Props) => {
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
        <div className={styles.modelCenterDialog}>
          <AlertDialog.Overlay className={styles.modelCenterDialogOverlay} />
          <AlertDialog.Content
            className={styles.modelCenterDialogContent}
            onOpenAutoFocus={e => e.preventDefault()}
          >
            <AlertDialog.Title className={styles.modelCenterDialogTitle}>
              Model Center
              <div className={styles.modelCenterDialogActions}>
                <AlertDialog.Cancel asChild>
                  <Button
                    className={`${styles.modelCenterDialogButton} ${styles.modelCenterDialogButtonCancel}`}
                    onClick={() => {}}
                    type={'icon-only'}
                  >
                    <TbX size={'14px'} />
                  </Button>
                </AlertDialog.Cancel>
              </div>
            </AlertDialog.Title>
            <div className={styles.modelCenterDialogMainContent}>
              <p>This is a fullscreen dialog for the Model Center.</p>
            </div>
          </AlertDialog.Content>
        </div>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};
