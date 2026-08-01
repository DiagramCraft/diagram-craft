import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import styles from './GroupsEditor.module.css';

/**
 * Multi-select over the workspace's entity schemas, used to edit a relation endpoint's
 * `schemaIds` constraint (the set of entity schemas allowed at that endpoint).
 */
export const SchemaMultiSelect = ({
  label,
  hint,
  schemas,
  selectedIds,
  onChange,
  disabled
}: {
  label: string;
  hint?: string;
  schemas: EntitySchema[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) => {
  const schemasById = new Map(schemas.map(schema => [schema.id, schema]));
  const availableSchemas = schemas.filter(schema => !selectedIds.includes(schema.id));

  return (
    <FormElement label={label} hint={hint}>
      {selectedIds.length > 0 && (
        <div className={styles.pickedList}>
          {selectedIds.map(schemaId => (
            <span key={schemaId} className={styles.pickedChip}>
              {schemasById.get(schemaId)?.name ?? 'Unavailable type'}
              {!disabled && (
                <button
                  type="button"
                  className={styles.pickedRemove}
                  title="Remove type"
                  onClick={() => onChange(selectedIds.filter(id => id !== schemaId))}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {!disabled && availableSchemas.length > 0 && (
        <Select.Root
          value={undefined}
          onChange={value => {
            if (value) onChange([...selectedIds, value]);
          }}
          placeholder="Add entity type..."
          style={{ width: '100%', marginTop: 6 }}
        >
          {availableSchemas.map(schema => (
            <Select.Item key={schema.id} value={schema.id}>
              {schema.name}
            </Select.Item>
          ))}
        </Select.Root>
      )}
    </FormElement>
  );
};
