import { useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Button } from '@diagram-craft/app-components/Button';
import type { DashboardSidebarConfig } from '@arch-register/api-types/dashboardContract';
import { useSchemas } from '../../hooks/useSchemas';
import { DialogContent, DialogSection } from '../markdown/editor/BlockDialog';
import styles from './WidgetConfigDialog.module.css';

type Props = {
  open: boolean;
  workspaceSlug: string;
  sidebar: DashboardSidebarConfig | null;
  onClose: () => void;
  onSave: (sidebar: DashboardSidebarConfig | null) => void;
};

const isValidVariableName = (value: string) => /^[a-zA-Z_]\w*$/.test(value);

/**
 * Configures a dashboard's optional selection sidebar (#3467). Only the `entity-picker` kind
 * exists today, so this form has no kind selector — it edits the entity-picker's schema, the
 * variable name its selection is exposed as (referenced by widget config as `$<variableName>`,
 * see `resolveSidebarVariableReferences.ts`), and the group label shown above the list.
 */
export const DashboardSidebarConfigDialog = ({
  open,
  workspaceSlug,
  sidebar,
  onClose,
  onSave
}: Props) => {
  // This dialog only authors the `entity-picker` kind today; a `facets` sidebar (#3467 follow-up)
  // has no config UI yet and can only be persisted by other means (e.g. seeded dashboards).
  const entityPicker = sidebar?.kind === 'entity-picker' ? sidebar : null;
  const schemas = useSchemas(workspaceSlug);
  const [schemaName, setSchemaName] = useState(entityPicker?.schemaName ?? '');
  const [variableName, setVariableName] = useState(entityPicker?.variableName ?? '');
  const [itemLabel, setItemLabel] = useState(entityPicker?.itemLabel ?? '');

  const canSave = schemaName.trim() !== '' && isValidVariableName(variableName.trim());

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Dashboard sidebar"
      width={460}
      footerLeft={
        sidebar && (
          <Button
            variant="danger"
            onClick={() => {
              onSave(null);
              onClose();
            }}
          >
            Remove sidebar
          </Button>
        )
      }
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        {
          label: 'Save',
          type: 'default',
          disabled: !canSave,
          onClick: () => {
            onSave({
              kind: 'entity-picker',
              schemaName: schemaName.trim(),
              variableName: variableName.trim(),
              itemLabel: itemLabel.trim() || undefined
            });
            onClose();
          }
        }
      ]}
    >
      <DialogContent>
        <DialogSection label="Entity schema">
          <select
            className={styles.selectInput}
            value={schemaName}
            onChange={event => setSchemaName(event.currentTarget.value)}
          >
            <option value="">Select a schema…</option>
            {(schemas.data ?? []).map(schema => (
              <option key={schema.id} value={schema.name}>
                {schema.name}
              </option>
            ))}
          </select>
        </DialogSection>
        <DialogSection label="Variable name">
          <input
            type="text"
            className={styles.labelInput}
            placeholder="e.g. apiEntityId"
            value={variableName}
            onChange={event => setVariableName(event.currentTarget.value)}
          />
          <div className={styles.hint}>
            Referenced in widget config as <code>${variableName || '<name>'}</code>.
          </div>
        </DialogSection>
        <DialogSection label="List label" required={false}>
          <input
            type="text"
            className={styles.labelInput}
            placeholder="e.g. APIs"
            value={itemLabel}
            onChange={event => setItemLabel(event.currentTarget.value)}
          />
        </DialogSection>
      </DialogContent>
    </Dialog>
  );
};
