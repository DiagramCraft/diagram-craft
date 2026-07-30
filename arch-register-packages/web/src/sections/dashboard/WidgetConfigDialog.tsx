import { useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import type { DashboardWidgetSpec } from '../markdown/mdx-components/types';
import type { WidgetSurface } from './dashboardWidgetDefaults';
import { DialogContent, DialogSection } from '../markdown/editor/BlockDialog';
import { useMdxContext } from '../markdown/MdxContext';
import { getDashboardWidgetSpec } from './dashboardWidgetRegistry';
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
  const spec = getDashboardWidgetSpec(widget.type);
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

  const canSave = spec.isValidConfig(config);
  const ConfigForm = spec.configForm;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={spec.label}
      width={spec.dialogWidth ?? 460}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        {
          label: 'Save',
          type: 'default',
          disabled: !canSave,
          onClick: () => onSave({ ...widget, config })
        }
      ]}
    >
      <DialogContent>
        {ConfigForm ? (
          <ConfigForm
            config={config}
            onChange={setConfig}
            context={{ workspaceSlug, projectId, surface }}
          />
        ) : (
          <DialogSection label="Options" required={false}>
            <div className={styles.optionRow}>
              <span className={styles.optionLabel}>This widget has no configurable options.</span>
            </div>
          </DialogSection>
        )}
      </DialogContent>
    </Dialog>
  );
};
