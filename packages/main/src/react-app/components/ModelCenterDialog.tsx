import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useState } from 'react';
import { usePortal } from '@diagram-craft/app-components/PortalContext';
import styles from './ModelCenterDialog.module.css';
import { TbX } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Tabs } from '@diagram-craft/app-components/Tabs';

type Props = {
  open: boolean;
  onClose: () => void;
};

export const ModelCenterDialog = (props: Props) => {
  const portal = usePortal();
  const [activeTab, setActiveTab] = useState('data');

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
              <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
                <Tabs.List>
                  <Tabs.Trigger value="data">Data</Tabs.Trigger>
                  <Tabs.Trigger value="schemas">Schemas</Tabs.Trigger>
                  <Tabs.Trigger value="model-providers">Model Providers</Tabs.Trigger>
                </Tabs.List>

                <Tabs.Content value="data">
                  <div>
                    <h3>Data Management</h3>
                    <p>Manage your data sources and datasets here.</p>
                  </div>
                </Tabs.Content>

                <Tabs.Content value="schemas">
                  <div>
                    <h3>Schema Management</h3>
                    <p>Define and manage your data schemas here.</p>
                  </div>
                </Tabs.Content>

                <Tabs.Content value="model-providers">
                  <div>
                    <h3>Model Providers</h3>
                    <p>Configure and manage your model providers here.</p>
                  </div>
                </Tabs.Content>
              </Tabs.Root>
            </div>
          </AlertDialog.Content>
        </div>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};
