import { Button } from '@diagram-craft/app-components/Button';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { ValidationRule } from '@arch-register/api-types/schemaContract';
import { ListEditor } from '../../components/ListEditor';
import styles from './SchemaSettingsScreen.module.css';

export const ValidationRulesEditor = ({
  rules,
  canEdit,
  variant = 'entity',
  previewPending = false,
  previewMessage = null,
  onPreview,
  onChange,
  createRule
}: {
  rules: ValidationRule[];
  canEdit: boolean;
  variant?: 'entity' | 'relation';
  previewPending?: boolean;
  previewMessage?: string | null;
  onPreview?: () => void;
  onChange: (rules: ValidationRule[]) => void;
  createRule: () => ValidationRule;
}) => {
  return (
    <>
      {previewMessage && <div className={styles.templateSummary}>{previewMessage}</div>}
      <ListEditor
        label="Validation rules"
        items={rules}
        onChange={onChange}
        getId={rule => rule.id}
        createItem={createRule}
        addLabel="Add rule"
        emptyMessage="No validation rules defined."
        layout="card"
        disabled={!canEdit}
        removeLabel="Delete rule"
        headerActions={
          onPreview && (
            <Button size="xs" onClick={onPreview} disabled={previewPending}>
              {previewPending ? 'Testing…' : 'Test rules'}
            </Button>
          )
        }
        renderActions={(rule, { update }) => (
          <Button size="xs" onClick={() => update({ active: !rule.active })}>
            {rule.active ? 'Deactivate' : 'Activate'}
          </Button>
        )}
        renderItem={(rule, { update }) => (
          <div className={styles.validationRuleFields}>
            <FormElement label="Name">
              <TextInput value={rule.name} onChange={value => update({ name: value ?? '' })} />
            </FormElement>
            <FormElement label="Expression">
              <TextArea
                value={rule.expression}
                onChange={value => update({ expression: value ?? '' })}
                rows={2}
                placeholder={variant === 'entity' ? "entity.status != 'retired'" : undefined}
              />
            </FormElement>
            <FormElement label="Message">
              <TextInput
                value={rule.message}
                onChange={value => update({ message: value ?? '' })}
                placeholder="Message shown when the rule fails"
              />
            </FormElement>
            <FormElement label="Severity">
              <Select.Root
                value={rule.severity}
                onChange={value =>
                  update({ severity: (value ?? 'error') as ValidationRule['severity'] })
                }
              >
                <Select.Item value="error">Blocking error</Select.Item>
                <Select.Item value="warning">Warning</Select.Item>
              </Select.Root>
            </FormElement>
          </div>
        )}
      />
    </>
  );
};
