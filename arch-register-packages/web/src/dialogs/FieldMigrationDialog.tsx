import { useEffect, useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Select } from '@diagram-craft/app-components/Select';
import type {
  FieldMigrationAction,
  PendingFieldChange
} from '@arch-register/api-types/schemaContract';

export type FieldMigrationChoices = Record<string, FieldMigrationAction['action']>;

const defaultChoice = (change: PendingFieldChange): FieldMigrationAction['action'] =>
  change.kind === 'renamed' ? 'rename' : 'remove';

export const FieldMigrationDialog = ({
  open,
  pendingChanges,
  onCancel,
  onConfirm
}: {
  open: boolean;
  pendingChanges: PendingFieldChange[];
  onCancel: () => void;
  onConfirm: (choices: FieldMigrationChoices) => void;
}) => {
  const [choices, setChoices] = useState<FieldMigrationChoices>({});

  useEffect(() => {
    if (!open) return;
    setChoices(
      Object.fromEntries(pendingChanges.map(change => [change.fieldId, defaultChoice(change)]))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pendingChanges]);

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title="Field changes need a migration decision"
      width={520}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onCancel },
        { label: 'Apply and save', type: 'default', onClick: () => onConfirm(choices) }
      ]}
    >
      <div style={{ display: 'grid', gap: 16 }}>
        <p style={{ margin: 0, fontSize: 13 }}>
          These fields already have entity data. Choose how to handle each one before saving.
        </p>
        {pendingChanges.map(change => (
          <div
            key={change.fieldId}
            style={{
              display: 'grid',
              gap: 6,
              borderTop: '1px solid var(--cmp-border)',
              paddingTop: 12
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 13 }}>{change.fieldName}</div>
            <div className="dim" style={{ fontSize: 12 }}>
              {change.kind === 'renamed' ? 'Detected as a rename' : 'Field removed from the schema'}{' '}
              &middot; {change.entityCount}{' '}
              {change.entityCount === 1 ? 'entity has' : 'entities have'} data in this field
            </div>
            <Select.Root
              value={choices[change.fieldId] ?? defaultChoice(change)}
              onChange={value =>
                setChoices(prev => ({
                  ...prev,
                  [change.fieldId]: (value ?? 'remove') as FieldMigrationAction['action']
                }))
              }
              style={{ width: 240 }}
            >
              {change.kind === 'renamed' && (
                <Select.Item value="rename">
                  Rename &mdash; keep the data under the new field
                </Select.Item>
              )}
              <Select.Item value="archive">
                Archive &mdash; hide the field, keep the data
              </Select.Item>
              <Select.Item value="remove">Remove &mdash; delete the field and its data</Select.Item>
            </Select.Root>
          </div>
        ))}
      </div>
    </Dialog>
  );
};
