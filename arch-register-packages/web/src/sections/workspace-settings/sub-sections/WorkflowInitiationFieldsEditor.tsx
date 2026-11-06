import { useEnums } from '../../../hooks/useEnums';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Scrollable } from '@diagram-craft/app-components/Scrollable';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { GovernanceInitiationField } from '@arch-register/api-types/governanceInitiationFields';
import styles from './WorkflowsSubSection.module.css';
import { ListEditor } from '../../../components/ListEditor';
import { Stack } from '../../../components/Stack';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';

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
  const createField = (): GovernanceInitiationField => ({
    id: `field-${fields.length + 1}`,
    label: 'New field',
    type: 'text',
    requirementLevel: 'optional'
  });

  return (
    <Stack>
      <div className={styles.hint}>
        These fields are requested when the workflow starts and shown to reviewers and recipients.
      </div>
      <Scrollable variant="compact" maxHeight={'21rem'}>
        <ListEditor
          items={fields}
          onChange={onChange}
          createItem={createField}
          label="Initiation fields"
          addLabel="Add initiation field"
          emptyMessage="No initiation fields defined."
          layout="card"
          reorder="drag"
          removeLabel="Remove field"
          renderItem={(field, { update }) => (
            <InitiationFieldMain field={field} onUpdate={update} />
          )}
          renderFooter={(field, { update }) => (
            <InitiationFieldDetails field={field} enums={enums} onUpdate={update} />
          )}
        />
      </Scrollable>
    </Stack>
  );
};

const InitiationFieldMain = ({
  field,
  onUpdate
}: {
  field: GovernanceInitiationField;
  onUpdate: (patch: Partial<GovernanceInitiationField>) => void;
}) => (
  <div style={{ display: 'flex', gap: '0.5rem' }}>
    <FormElement label="ID">
      <TextInput value={field.id} onChange={value => onUpdate({ id: value ?? '' })} />
    </FormElement>
    <FormElement label="Label">
      <TextInput value={field.label} onChange={value => onUpdate({ label: value ?? '' })} />
    </FormElement>
    <FormElement label="Type">
      <Select.Root
        value={field.type}
        onChange={value =>
          onUpdate(
            value === 'rating' ? { type: 'rating', max: 5 } : { type: value as 'text' | 'enum' }
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
        onChange={value => onUpdate({ requirementLevel: value as 'required' | 'optional' })}
      >
        <Select.Item value="required">Required</Select.Item>
        <Select.Item value="optional">Optional</Select.Item>
      </Select.Root>
    </FormElement>
  </div>
);

const InitiationFieldDetails = ({
  field,
  enums,
  onUpdate
}: {
  field: GovernanceInitiationField;
  enums: WorkspaceEnum[];
  onUpdate: (patch: Partial<GovernanceInitiationField>) => void;
}) =>
  field.type !== 'rating' && field.type !== 'enum' ? undefined : (
    <div
      style={{
        borderTop: '1px solid var(--panel-border)',
        margin: '0.5rem -0.5rem 0 -0.5rem',
        padding: '0.5rem 0.5rem 0 30px',
        minHeight: '1rem',
        display: 'flex',
        gap: '0.5rem'
      }}
    >
      {field.type === 'rating' && (
        <FormElement label="Maximum rating">
          <TextInput
            type="number"
            value={String(field.max ?? 5)}
            onChange={value => onUpdate({ max: Math.max(2, Number(value ?? 5)) })}
          />
        </FormElement>
      )}
      {field.type === 'enum' && (
        <>
          <FormElement label="Workspace enumeration">
            <Select.Root
              value={field.enumId}
              placeholder="Use inline options"
              onChange={value => onUpdate({ enumId: value, options: undefined })}
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
                  onUpdate({
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
    </div>
  );
