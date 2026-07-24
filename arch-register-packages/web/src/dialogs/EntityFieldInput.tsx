import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { EntitySummary } from '@arch-register/api-types/entityContract';

export const EntityFieldInput = ({
  field,
  value,
  onChange,
  referenceOptions
}: {
  field: EntitySchema['fields'][number];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  referenceOptions?: Record<string, EntitySummary[]>;
}) => {
  if (field.type === 'reference') {
    const candidates = referenceOptions?.[field.schemaId] ?? [];
    return (
      <FormElement label={field.name} required={field.requirementLevel !== 'optional'}>
        <select
          multiple
          value={Array.isArray(value) ? value : []}
          onChange={event =>
            onChange(Array.from(event.currentTarget.selectedOptions, option => option.value))
          }
          style={{ width: '100%', minHeight: 120 }}
        >
          {candidates.map(entity => (
            <option key={entity._uid} value={entity._uid}>
              {entity._name ?? entity._slug}
            </option>
          ))}
        </select>
      </FormElement>
    );
  }

  if (field.type === 'containment') {
    const candidates = referenceOptions?.[field.schemaId] ?? [];
    const selected = Array.isArray(value) ? (value[0] ?? '') : '';
    return (
      <FormElement label={field.name} required={field.requirementLevel !== 'optional'}>
        <Select.Root
          value={selected ?? undefined}
          onChange={next => onChange(next ? [next] : [])}
          placeholder="—"
          style={{ width: '100%' }}
        >
          {candidates.map(entity => (
            <Select.Item key={entity._uid} value={entity._uid}>
              {entity._name ?? entity._slug}
            </Select.Item>
          ))}
        </Select.Root>
      </FormElement>
    );
  }

  if (field.type === 'select') {
    return (
      <FormElement label={field.name} required={field.requirementLevel !== 'optional'}>
        <Select.Root
          value={typeof value === 'string' ? (value ?? undefined) : undefined}
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
          value={typeof value === 'string' ? value : ''}
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
          value={typeof value === 'string' ? (value ?? undefined) : undefined}
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
          value={typeof value === 'string' ? value : ''}
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
          value={typeof value === 'string' ? value : ''}
          onChange={event => onChange(event.target.value)}
          style={{ width: '100%' }}
        />
      </FormElement>
    );
  }

  return (
    <FormElement label={field.name} required={field.requirementLevel !== 'optional'}>
      <TextInput
        value={typeof value === 'string' ? value : ''}
        onChange={next => onChange(next ?? '')}
        style={{ width: '100%' }}
      />
    </FormElement>
  );
};
