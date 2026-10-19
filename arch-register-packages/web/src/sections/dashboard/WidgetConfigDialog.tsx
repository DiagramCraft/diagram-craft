import { useState } from 'react';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import type { DashboardWidgetWidgetDefinition, WidgetSurface } from '../../widgets/shared/types';
import { DialogContent, DialogSection } from '../markdown/editor/BlockDialog';
import { getConfigDialogWidth } from '../../widgets/shared/configDialog';
import { getWidgetDefinition, isValidComponentConfig } from '../../widgets/shared/widgetRegistry';
import type { DashboardWidgetFrame } from '@arch-register/api-types/dashboardContract';
import { WidgetFrameSettingsForm } from '../../widgets/shared/dashboard/WidgetFrameSettingsForm';
import { normalizeFrame } from '../../widgets/shared/dashboard/widgetFrameSettings';
import styles from './WidgetConfigDialog.module.css';

type Props = {
  widget: DashboardWidget | null;
  open: boolean;
  surface?: WidgetSurface;
  onClose: () => void;
  onSave: (widget: DashboardWidget) => void;
};

export const WidgetConfigDialog = ({
  widget,
  open,
  surface = 'workspace',
  onClose,
  onSave
}: Props) => {
  if (!widget) return null;
  const definition = getWidgetDefinition(widget.type, 'dashboard');
  if (!definition) return null;

  return (
    <WidgetConfigDialogContent
      key={widget.id}
      widget={widget}
      definition={definition}
      open={open}
      surface={surface}
      onClose={onClose}
      onSave={onSave}
    />
  );
};

// Tabs.Content defaults to a fixed 12rem height; let it follow the form instead (and fill large dialogs)
const tabContentStyle = { height: 'auto', minHeight: 0, flex: 1, overflow: 'auto' } as const;

const WidgetConfigDialogContent = ({
  widget,
  definition,
  open,
  surface,
  onClose,
  onSave
}: Props & {
  widget: DashboardWidget;
  definition: DashboardWidgetWidgetDefinition;
  surface: WidgetSurface;
}) => {
  const { dashboard: spec, configForm: ConfigForm } = definition;
  const [config, setConfig] = useState<Record<string, unknown>>(widget.config);

  const [frame, setFrame] = useState<DashboardWidgetFrame>(widget.frame ?? {});

  const canSave = isValidComponentConfig(definition, config);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={definition.name}
      width={getConfigDialogWidth(definition.configDialog)}
      className={definition.configDialog?.size === 'large' ? styles.largeDialog : undefined}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        {
          label: 'Save',
          type: 'default',
          disabled: !canSave,
          onClick: () => onSave({ ...widget, config, frame: normalizeFrame(frame) })
        }
      ]}
    >
      <div className={styles.tabs}>
        <Tabs.Root defaultValue="settings">
          <Tabs.List>
            <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
            <Tabs.Trigger value="appearance">Appearance</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="settings" style={tabContentStyle}>
            <DialogContent>
              {ConfigForm ? (
                <ConfigForm
                  config={config}
                  onChange={setConfig}
                  context={{ mode: 'dashboard', surface }}
                />
              ) : (
                <DialogSection label="Options" required={false}>
                  <div className={styles.optionRow}>
                    <span className={styles.optionLabel}>
                      This widget has no configurable options.
                    </span>
                  </div>
                </DialogSection>
              )}
            </DialogContent>
          </Tabs.Content>
          <Tabs.Content value="appearance" style={tabContentStyle}>
            <DialogContent>
              <WidgetFrameSettingsForm
                frame={frame}
                onChange={setFrame}
                defaultTitle={spec.getTitle?.(config as never) ?? definition.name}
              />
            </DialogContent>
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </Dialog>
  );
};
