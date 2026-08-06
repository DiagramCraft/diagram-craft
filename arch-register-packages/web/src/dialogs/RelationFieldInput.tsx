import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { MultiSelect, type MultiSelectItem } from '@diagram-craft/app-components/MultiSelect';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import { useEntitiesBySchema } from '../hooks/useEntities';
import { relationIds } from '../lib/entityEditState';

export const RelationFieldInput = ({
  workspaceId,
  field,
  value,
  onChange,
  disabled
}: {
  workspaceId: string;
  field: RelationSchema['fields'][number];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  disabled?: boolean;
}) => {
  const candidateQuery = useEntitiesBySchema(
    workspaceId,
    field.type === 'entityRelation' ? [field.schemaId] : []
  )[0];

  if (field.type === 'entityRelation') {
    const availableItems: MultiSelectItem[] = (candidateQuery?.data ?? []).map(entity => ({
      value: entity._uid,
      label: entity._name ?? entity._slug
    }));
    return (
      <FormElement label={field.name} required={field.requirementLevel !== 'optional'}>
        <MultiSelect
          selectedValues={relationIds(value)}
          availableItems={availableItems}
          onSelectionChange={onChange}
          disabled={disabled}
          placeholder={`Search ${field.name.toLowerCase()}...`}
          style={{ width: '100%' }}
        />
      </FormElement>
    );
  }

  const stringValue = typeof value === 'string' ? value : '';

  if (field.type === 'select') {
    return (
      <FormElement label={field.name} required={field.requirementLevel !== 'optional'}>
        <Select.Root
          value={stringValue ?? undefined}
          disabled={disabled}
          onChange={next => onChange(next ?? '')}
          placeholder="—"
          style={{ width: '100%' }}
        >
          {field.options.map(option => (
            <Select.Item key={option.value} value={option.value}>
              {option.label}
            </Select.Item>
          ))}
        </Select.Root>
      </FormElement>
    );
  }

  if (field.type === 'longtext') {
    return (
      <FormElement label={field.name} required={field.requirementLevel !== 'optional'}>
        <TextArea
          value={stringValue}
          disabled={disabled}
          onChange={next => onChange(next ?? '')}
          rows={3}
          style={{ width: '100%' }}
        />
      </FormElement>
    );
  }

  if (field.type === 'boolean') {
    return (
      <FormElement label={field.name} required={field.requirementLevel !== 'optional'}>
        <Select.Root
          value={stringValue ?? undefined}
          disabled={disabled}
          onChange={next => onChange(next ?? '')}
          placeholder="Not set"
          style={{ width: '100%' }}
        >
          <Select.Item value="true">True</Select.Item>
          <Select.Item value="false">False</Select.Item>
        </Select.Root>
      </FormElement>
    );
  }

  if (field.type === 'date') {
    return (
      <FormElement label={field.name} required={field.requirementLevel !== 'optional'}>
        <input
          type="date"
          disabled={disabled}
          value={stringValue}
          onChange={event => onChange(event.target.value)}
          style={{ width: '100%' }}
        />
      </FormElement>
    );
  }

  if (field.type === 'number') {
    return (
      <FormElement label={field.name} required={field.requirementLevel !== 'optional'}>
        <input
          type="number"
          step="1"
          min={field.min}
          max={field.max}
          disabled={disabled}
          value={stringValue}
          onChange={event => onChange(event.target.value)}
          style={{ width: '100%' }}
        />
      </FormElement>
    );
  }

  return (
    <FormElement label={field.name} required={field.requirementLevel !== 'optional'}>
      <TextInput
        value={stringValue}
        disabled={disabled}
        onChange={next => onChange(next ?? '')}
        style={{ width: '100%' }}
      />
    </FormElement>
  );
};
