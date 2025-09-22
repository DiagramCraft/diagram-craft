import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useState, useEffect } from 'react';
import { usePortal } from '@diagram-craft/app-components/PortalContext';
import styles from './ModelCenterDialog.module.css';
import { TbX } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { DataTab } from './DataTab';
import { SchemasTab } from './SchemasTab';
import { ModelProvidersTab } from './ModelProvidersTab';

type Props = {
  open: boolean;
  onClose: () => void;
  defaultTab?: 'data' | 'schemas' | 'model-providers';
};

export const ModelCenterDialog = (props: Props) => {
  const portal = usePortal();
  const [activeTab, setActiveTab] = useState(props.defaultTab ?? 'data');

  // Reset to defaultTab when dialog is opened
  useEffect(() => {
    if (props.open) {
      setActiveTab(props.defaultTab ?? 'data');
    }
  }, [props.open, props.defaultTab]);

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
              <Tabs.Root
                value={activeTab}
                onValueChange={value =>
                  setActiveTab(value as 'data' | 'schemas' | 'model-providers')
                }
              >
                <Tabs.List>
                  <Tabs.Trigger value="data">Data</Tabs.Trigger>
                  <Tabs.Trigger value="schemas">Schemas</Tabs.Trigger>
                  <Tabs.Trigger value="model-providers">Model Providers</Tabs.Trigger>
                </Tabs.List>

                <Tabs.Content value="data">
                  <DataTab />
                </Tabs.Content>

                <Tabs.Content value="schemas">
                  <SchemasTab />
                </Tabs.Content>

                <Tabs.Content value="model-providers">
                  <ModelProvidersTab />
                </Tabs.Content>
              </Tabs.Root>
            </div>
          </AlertDialog.Content>
        </div>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};
