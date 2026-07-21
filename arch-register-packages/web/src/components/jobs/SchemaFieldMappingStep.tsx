import { Select } from '@diagram-craft/app-components/Select';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import type { EntitySchema, SchemaField } from '@arch-register/api-types/schemaContract';
import styles from './JobWizard.module.css';

export type SchemaFieldMappingDefinition = {
  id: string;
  label: string;
  description: string;
  direction: 'input' | 'output';
  required?: boolean;
  allowedTypes: SchemaField['type'][];
  value: string | null;
};

export type SchemaFieldMappingStepProps = {
  schema: EntitySchema | null;
  definitions: SchemaFieldMappingDefinition[];
  onChange: (id: string, fieldId: string | null) => void;
};

const UNSET = '__unset__';

export const SchemaFieldMappingStep = ({
  schema,
  definitions,
  onChange
}: SchemaFieldMappingStepProps) => {
  if (!schema) {
    return <div className={styles.notice}>Choose a target schema before mapping fields.</div>;
  }

  return (
    <div className={styles.stepStack}>
      <div>
        <div className={styles.stepTitle}>Map input and output fields</div>
        <div className={styles.stepDescription}>
          Choose the fields the job reads from and the fields it maintains separately.
        </div>
      </div>
      <div className={styles.mappingColumns}>
        {(['input', 'output'] as const).map(direction => {
          const columnDefinitions = definitions.filter(
            definition => definition.direction === direction
          );
          return (
            <section key={direction} className={styles.mappingColumn}>
              <div className={styles.mappingColumnHeader}>
                <div className={styles.mappingColumnTitle}>
                  {direction === 'input' ? 'Job inputs' : 'Job outputs'}
                </div>
                <div className={styles.mappingColumnDescription}>
                  {direction === 'input'
                    ? 'Read from each target entity.'
                    : 'Updated from endoflife.date and marked external.'}
                </div>
              </div>
              <div className={styles.mappingList}>
                {columnDefinitions.map(definition => {
                  const usedByOtherDefinition = new Set(
                    definitions
                      .filter(candidate => candidate.id !== definition.id)
                      .map(candidate => candidate.value)
                      .filter((fieldId): fieldId is string => fieldId != null)
                  );
                  const options = schema.fields.filter(
                    field =>
                      !field.archived &&
                      definition.allowedTypes.includes(field.type) &&
                      (!usedByOtherDefinition.has(field.id) || field.id === definition.value)
                  );
                  const selected = schema.fields.find(field => field.id === definition.value);
                  const externalNotice = selected?.external_kind
                    ? `${selected.name} is already marked as ${selected.external_kind}-managed.`
                    : undefined;

                  return (
                    <FormElement
                      key={definition.id}
                      label={definition.label}
                      required={definition.required ?? false}
                      hint={definition.description}
                    >
                      <Select.Root
                        value={definition.value ?? UNSET}
                        placeholder="Not mapped"
                        onChange={value =>
                          onChange(definition.id, !value || value === UNSET ? null : value)
                        }
                      >
                        <Select.Item value={UNSET}>Not mapped</Select.Item>
                        {options.map(field => (
                          <Select.Item key={field.id} value={field.id}>
                            {field.name} · {field.type}
                          </Select.Item>
                        ))}
                      </Select.Root>
                      {externalNotice && <div className={styles.warning}>{externalNotice}</div>}
                      {definition.value != null && usedByOtherDefinition.has(definition.value) && (
                        <div className={styles.warning}>
                          This field is already mapped to another role.
                        </div>
                      )}
                    </FormElement>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
