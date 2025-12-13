import { useState, useEffect } from 'react';
import { usePortal } from '@diagram-craft/app-components/PortalContext';
import styles from './ModelCenterDialog.module.css';
import { TbX } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { DataTab } from './DataTab';
import { SchemasTab } from './SchemasTab';
import { ModelProvidersTab } from './ModelProvidersTab';
import { DialogCommand } from '@diagram-craft/canvas/context';
import { AlertDialog as BaseUIAlertDialog } from '@base-ui-components/react/alert-dialog';

type Props = {
  open: boolean;
  onClose: () => void;
  defaultTab?: 'data' | 'schemas' | 'model-providers';
};

export type ModelCenterDialogProps = {
  defaultTab?: 'data' | 'schemas' | 'model-providers';
};

export class ModelCenterDialogCommand implements DialogCommand<ModelCenterDialogProps, void> {
  id = 'modelCenter';

  constructor(
    public readonly props: ModelCenterDialogProps = {},
    public readonly onOk: () => void = () => {},
    public readonly onCancel: () => void = () => {}
  ) {}
}

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
    <BaseUIAlertDialog.Root
      open={props.open}
      defaultOpen={props.open}
      onOpenChange={(open: boolean) => {
        if (!open) {
          props.onClose();
        }
      }}
    >
      <BaseUIAlertDialog.Portal container={portal}>
        <div className={styles.modelCenterDialog}>
          <BaseUIAlertDialog.Backdrop className={styles.modelCenterDialogOverlay} />
          <BaseUIAlertDialog.Viewport className={styles.modelCenterDialogContent}>
            <BaseUIAlertDialog.Popup initialFocus={false}>
              <BaseUIAlertDialog.Title className={styles.modelCenterDialogTitle}>
                Model Center
                <div className={styles.modelCenterDialogActions}>
                  <BaseUIAlertDialog.Close
                    render={
                      <Button
                        className={`${styles.modelCenterDialogButton} ${styles.modelCenterDialogButtonCancel}`}
                        onClick={() => {}}
                        type={'icon-only'}
                      >
                        <TbX size={'14px'} />
                      </Button>
                    }
                  />
                </div>
              </BaseUIAlertDialog.Title>
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
            </BaseUIAlertDialog.Popup>
          </BaseUIAlertDialog.Viewport>
        </div>
      </BaseUIAlertDialog.Portal>
    </BaseUIAlertDialog.Root>
  );
};
