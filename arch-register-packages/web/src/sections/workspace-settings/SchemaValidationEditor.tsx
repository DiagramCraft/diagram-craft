import { Button } from '@diagram-craft/app-components/Button';
import { Select } from '@diagram-craft/app-components/Select';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TbPlus, TbTrash } from 'react-icons/tb';
import type { ValidationRule } from '@arch-register/api-types/schemaContract';
import styles from './SchemaSettingsScreen.module.css';

export const SchemaValidationEditor = ({
  rules,
  canEdit,
  previewPending,
  previewMessage,
  onPreview,
  onAdd,
  onUpdate,
  onToggle,
  onDelete
}: {
  rules: ValidationRule[];
  canEdit: boolean;
  previewPending: boolean;
  previewMessage: string | null;
  onPreview: () => void;
  onAdd: () => void;
  onUpdate: (index: number, patch: Partial<ValidationRule>) => void;
  onToggle: (index: number) => void;
  onDelete: (index: number) => void;
}) => (
  <>
    <div className={styles.fieldsHead}>
      <div className={styles.sectionLabel}>Validation rules</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="ghost" onClick={onPreview} disabled={previewPending}>
          {previewPending ? 'Testing…' : 'Test rules'}
        </Button>
        {canEdit && (
          <Button variant="ghost" icon={<TbPlus size={11} />} onClick={onAdd}>
            Add rule
          </Button>
        )}
      </div>
    </div>
    {previewMessage && <div className={styles.templateSummary}>{previewMessage}</div>}
    {rules.length === 0 ? (
      <div className={styles.fieldsEmpty}>No validation rules defined.</div>
    ) : (
      <div className={styles.templateList}>
        {rules.map((rule, index) => (
          <div className={styles.templateRow} key={rule.id}>
            <div style={{ flex: 1, display: 'grid', gap: 8 }}>
              <TextInput
                value={rule.name}
                disabled={!canEdit}
                onChange={value => onUpdate(index, { name: value ?? '' })}
              />
              <TextArea
                value={rule.expression}
                disabled={!canEdit}
                onChange={value => onUpdate(index, { expression: value ?? '' })}
                rows={2}
                placeholder="entity.status != 'retired'"
              />
              <TextInput
                value={rule.message}
                disabled={!canEdit}
                onChange={value => onUpdate(index, { message: value ?? '' })}
                placeholder="Message shown when the rule fails"
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <Select.Root
                  value={rule.severity}
                  disabled={!canEdit}
                  onChange={value =>
                    onUpdate(index, { severity: (value ?? 'error') as ValidationRule['severity'] })
                  }
                >
                  <Select.Item value="error">Blocking error</Select.Item>
                  <Select.Item value="warning">Warning</Select.Item>
                </Select.Root>
                <Button variant="ghost" disabled={!canEdit} onClick={() => onToggle(index)}>
                  {rule.active ? 'Deactivate' : 'Activate'}
                </Button>
                {canEdit && (
                  <Button
                    variant="ghost"
                    icon={<TbTrash size={12} />}
                    onClick={() => onDelete(index)}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </>
);
