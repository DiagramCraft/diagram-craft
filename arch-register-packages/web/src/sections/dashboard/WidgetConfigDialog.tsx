import { useState } from 'react';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import type { DashboardWidgetSpec } from '../markdown/mdx-components/types';
import type { WidgetSurface } from './dashboardWidgetDefaults';
import { DialogContent, DialogSection } from '../markdown/editor/BlockDialog';
import { useMdxContext } from '../markdown/MdxContext';
import './dashboardWidgetRegistry';
import { getComponentDefinition } from '../markdown/mdx-components/componentRegistry';
import type { DashboardWidgetFrame } from '@arch-register/api-types/dashboardContract';
import { WidgetFrameSettingsForm } from './widgets/WidgetFrameSettingsForm';
import { defaultShowFrame, normalizeFrame } from './widgets/widgetFrameSettings';
import styles from './WidgetConfigDialog.module.css';

type Props = {
  widget: DashboardWidget | null;
  open: boolean;
  workspaceSlug: string;
  surface?: WidgetSurface;
  onClose: () => void;
  onSave: (widget: DashboardWidget) => void;
};

export const WidgetConfigDialog = ({
  widget,
  open,
  workspaceSlug,
  surface = 'workspace',
  onClose,
  onSave
}: Props) => {
  if (!widget) return null;
  const spec = getComponentDefinition(widget.type, 'dashboardWidget')?.dashboardWidget;
  if (!spec) return null;

  return (
    <WidgetConfigDialogContent
      key={widget.id}
      widget={widget}
      spec={spec}
      open={open}
      workspaceSlug={workspaceSlug}
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
  spec,
  open,
  workspaceSlug,
  surface,
  onClose,
  onSave
}: Props & { widget: DashboardWidget; spec: DashboardWidgetSpec; surface: WidgetSurface }) => {
  const { projectId } = useMdxContext();
  const [config, setConfig] = useState<Record<string, unknown>>(widget.config);

  const [frame, setFrame] = useState<DashboardWidgetFrame>(widget.frame ?? {});

  const canSave = spec.isValidConfig(config);
  const ConfigForm = spec.configForm;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={spec.label}
      width={spec.dialogSize === 'large' ? '90vw' : (spec.dialogWidth ?? 460)}
      className={spec.dialogSize === 'large' ? styles.largeDialog : undefined}
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
                  context={{ mode: 'dashboard', workspaceSlug, projectId, surface }}
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
                defaultTitle={spec.getTitle?.(config as never) ?? spec.label}
                defaultShowFrame={defaultShowFrame(spec, config)}
              />
            </DialogContent>
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </Dialog>
  );
};
