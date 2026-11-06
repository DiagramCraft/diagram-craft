import { MultiSelect, type MultiSelectItem } from '@diagram-craft/app-components/MultiSelect';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { selectableEnumOptions } from '../utils/enumOptions';

type SelectField = Extract<EntitySchema['fields'][number], { type: 'select' }>;

/** Multi-valued `select` field input, shared by the entity dialog and the property row. */
export const ScalarMultiSelect = ({
  field,
  value,
  onChange,
  disabled
}: {
  field: SelectField;
  value: unknown;
  onChange: (values: string[]) => void;
  disabled?: boolean;
}) => {
  const availableItems: MultiSelectItem[] = selectableEnumOptions(field.options, value).map(
    option => ({ value: option.value, label: option.label })
  );
  return (
    <MultiSelect
      selectedValues={Array.isArray(value) ? (value as string[]) : []}
      availableItems={availableItems}
      onSelectionChange={onChange}
      disabled={disabled}
      placeholder={`Select ${field.name.toLowerCase()}...`}
      style={{ width: '100%' }}
    />
  );
};
