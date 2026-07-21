import { Select } from '@diagram-craft/app-components/Select';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import styles from './JobWizard.module.css';

export type SchemaPickerStepProps = {
  schemas: EntitySchema[];
  value: string;
  onChange: (schemaId: string) => void;
  isLoading?: boolean;
  isError?: boolean;
};

export const SchemaPickerStep = ({
  schemas,
  value,
  onChange,
  isLoading = false,
  isError = false
}: SchemaPickerStepProps) => {
  const selected = schemas.find(schema => schema.id === value);

  return (
    <div className={styles.stepStack}>
      <div>
        <div className={styles.stepTitle}>Choose a target schema</div>
        <div className={styles.stepDescription}>
          The job will inspect entities in this schema and update the mapped destination fields.
        </div>
      </div>
      <FormElement
        label="Target schema"
        hint={selected ? `${selected.entity_count} entities use this schema.` : undefined}
        error={isError ? 'Schemas could not be loaded.' : undefined}
      >
        {isLoading ? (
          <div className={styles.loading}>Loading schemas…</div>
        ) : (
          <Select.Root
            value={value === '' ? undefined : value}
            placeholder="Select a schema"
            onChange={next => onChange(next ?? '')}
            disabled={schemas.length === 0}
          >
            {schemas.map(schema => (
              <Select.Item key={schema.id} value={schema.id}>
                {schema.name} ({schema.entity_count})
              </Select.Item>
            ))}
          </Select.Root>
        )}
      </FormElement>
      {!isLoading && !isError && schemas.length === 0 && (
        <div className={styles.notice}>No schemas are available in this workspace.</div>
      )}
      {selected && (
        <div className={styles.schemaCard}>
          <div className={styles.schemaName}>{selected.name}</div>
          <div className={styles.schemaDescription}>
            {selected.description ?? 'No description.'}
          </div>
          <div className={styles.schemaMeta}>{selected.fields.length} fields</div>
        </div>
      )}
    </div>
  );
};
