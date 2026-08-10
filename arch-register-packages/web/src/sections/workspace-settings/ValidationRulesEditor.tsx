import { Button } from '@diagram-craft/app-components/Button';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TbPlus, TbTrash } from 'react-icons/tb';
import type { ValidationRule } from '@arch-register/api-types/schemaContract';
import styles from './SchemaSettingsScreen.module.css';

export const ValidationRulesEditor = ({
  rules,
  canEdit,
  variant = 'entity',
  previewPending = false,
  previewMessage = null,
  onPreview,
  onAdd,
  onUpdate,
  onToggle,
  onDelete
}: {
  rules: ValidationRule[];
  canEdit: boolean;
  variant?: 'entity' | 'relation';
  previewPending?: boolean;
  previewMessage?: string | null;
  onPreview?: () => void;
  onAdd: () => void;
  onUpdate: (index: number, patch: Partial<ValidationRule>) => void;
  onToggle: (index: number) => void;
  onDelete: (index: number) => void;
}) => {
  if (variant === 'relation') {
    return (
      <>
        <div className={styles.fieldsHead}>
          <div className={styles.sectionLabel}>Validation rules</div>
          {canEdit && (
            <Button variant="ghost" icon={<TbPlus size={11} />} onClick={onAdd}>
              Add rule
            </Button>
          )}
        </div>
        <div className={styles.fieldsTable}>
          {rules.map((rule, index) => (
            <div className={styles.formRow} key={rule.id}>
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
              />
              <TextInput
                value={rule.message}
                disabled={!canEdit}
                onChange={value => onUpdate(index, { message: value ?? '' })}
              />
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
                />
              )}
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <div className={styles.fieldsHead}>
        <div className={styles.sectionLabel}>Validation rules</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {onPreview && (
            <Button variant="ghost" onClick={onPreview} disabled={previewPending}>
              {previewPending ? 'Testing…' : 'Test rules'}
            </Button>
          )}
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
            <div
              className={`${styles.templateRow} ${styles.validationRuleRow}`}
              key={rule.id}
            >
              <div className={styles.validationRuleActions}>
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
              <div className={styles.validationRuleFields}>
                <FormElement label="Name">
                  <TextInput
                    value={rule.name}
                    disabled={!canEdit}
                    onChange={value => onUpdate(index, { name: value ?? '' })}
                  />
                </FormElement>
                <FormElement label="Expression">
                  <TextArea
                    value={rule.expression}
                    disabled={!canEdit}
                    onChange={value => onUpdate(index, { expression: value ?? '' })}
                    rows={2}
                    placeholder="entity.status != 'retired'"
                  />
                </FormElement>
                <FormElement label="Message">
                  <TextInput
                    value={rule.message}
                    disabled={!canEdit}
                    onChange={value => onUpdate(index, { message: value ?? '' })}
                    placeholder="Message shown when the rule fails"
                  />
                </FormElement>
                <FormElement label="Severity">
                  <Select.Root
                    value={rule.severity}
                    disabled={!canEdit}
                    onChange={value =>
                      onUpdate(index, {
                        severity: (value ?? 'error') as ValidationRule['severity']
                      })
                    }
                  >
                    <Select.Item value="error">Blocking error</Select.Item>
                    <Select.Item value="warning">Warning</Select.Item>
                  </Select.Root>
                </FormElement>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};
