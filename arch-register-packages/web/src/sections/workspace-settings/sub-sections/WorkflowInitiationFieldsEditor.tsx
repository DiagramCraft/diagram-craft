import { useEnums } from '../../../hooks/useEnums';
import { Button } from '@diagram-craft/app-components/Button';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { GovernanceInitiationField } from '@arch-register/api-types/governanceInitiationFields';
import { WorkflowBlock } from './WorkflowEditorPrimitives';
import styles from './WorkflowsSubSection.module.css';

export type WorkflowInitiationFieldsEditorProps = {
  workspaceSlug: string;
  fields: GovernanceInitiationField[];
  onChange: (fields: GovernanceInitiationField[]) => void;
};

export const WorkflowInitiationFieldsEditor = ({
  workspaceSlug,
  fields,
  onChange
}: WorkflowInitiationFieldsEditorProps) => {
  const { data: enums = [] } = useEnums(workspaceSlug);
  const updateField = (index: number, patch: Partial<GovernanceInitiationField>) =>
    onChange(
      fields.map((field, fieldIndex) => (fieldIndex === index ? { ...field, ...patch } : field))
    );
  const addField = () =>
    onChange([
      ...fields,
      {
        id: `field-${fields.length + 1}`,
        label: 'New field',
        type: 'text',
        requirementLevel: 'optional'
      }
    ]);

  return (
    <div className={styles.workflowBlocks}>
      <div className={styles.hint}>
        These fields are requested when the workflow starts and shown to reviewers and recipients.
      </div>
      {fields.map((field, index) => (
        <WorkflowBlock key={`${field.id}-${index}`} title={field.label || 'Initiation field'}>
          <FormElement label="Field id">
            <TextInput
              value={field.id}
              onChange={value => updateField(index, { id: value ?? '' })}
            />
          </FormElement>
          <FormElement label="Label">
            <TextInput
              value={field.label}
              onChange={value => updateField(index, { label: value ?? '' })}
            />
          </FormElement>
          <FormElement label="Type">
            <Select.Root
              value={field.type}
              onChange={value =>
                updateField(
                  index,
                  value === 'rating'
                    ? { type: 'rating', max: 5 }
                    : { type: value as 'text' | 'enum' }
                )
              }
            >
              <Select.Item value="text">Text</Select.Item>
              <Select.Item value="rating">Rating</Select.Item>
              <Select.Item value="enum">Single select</Select.Item>
            </Select.Root>
          </FormElement>
          <FormElement label="Requirement">
            <Select.Root
              value={field.requirementLevel}
              onChange={value =>
                updateField(index, { requirementLevel: value as 'required' | 'optional' })
              }
            >
              <Select.Item value="required">Required</Select.Item>
              <Select.Item value="optional">Optional</Select.Item>
            </Select.Root>
          </FormElement>
          {field.type === 'rating' && (
            <FormElement label="Maximum rating">
              <TextInput
                type="number"
                value={String(field.max ?? 5)}
                onChange={value => updateField(index, { max: Math.max(2, Number(value ?? 5)) })}
              />
            </FormElement>
          )}
          {field.type === 'enum' && (
            <>
              <FormElement label="Workspace enumeration">
                <Select.Root
                  value={field.enumId}
                  placeholder="Use inline options"
                  onChange={value => updateField(index, { enumId: value, options: undefined })}
                >
                  {enums.map(enumeration => (
                    <Select.Item key={enumeration.id} value={enumeration.id}>
                      {enumeration.name}
                    </Select.Item>
                  ))}
                </Select.Root>
              </FormElement>
              {!field.enumId && (
                <FormElement label="Inline options (value: label, one per line)">
                  <TextInput
                    value={(field.options ?? [])
                      .map(option => `${option.value}: ${option.label}`)
                      .join('\n')}
                    onChange={value =>
                      updateField(index, {
                        options: (value ?? '')
                          .split('\n')
                          .map(line => line.trim())
                          .filter(Boolean)
                          .map(line => {
                            const separator = line.indexOf(':');
                            return separator < 0
                              ? { value: line, label: line }
                              : {
                                  value: line.slice(0, separator).trim(),
                                  label: line.slice(separator + 1).trim()
                                };
                          })
                      })
                    }
                  />
                </FormElement>
              )}
            </>
          )}
          <Button
            variant="ghost"
            onClick={() => onChange(fields.filter((_, fieldIndex) => fieldIndex !== index))}
          >
            Remove field
          </Button>
        </WorkflowBlock>
      ))}
      <Button variant="secondary" onClick={addField}>
        Add initiation field
      </Button>
    </div>
  );
};
