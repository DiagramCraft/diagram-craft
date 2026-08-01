import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';

export const RelationFieldInput = ({
  field,
  value,
  onChange,
  disabled
}: {
  field: RelationSchema['fields'][number];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) => {
  if (field.type === 'select') {
    return (
      <FormElement label={field.name} required={field.requirementLevel !== 'optional'}>
        <Select.Root
          value={value ?? undefined}
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
          value={value}
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
          value={value ?? undefined}
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
          value={value}
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
          value={value}
          onChange={event => onChange(event.target.value)}
          style={{ width: '100%' }}
        />
      </FormElement>
    );
  }

  return (
    <FormElement label={field.name} required={field.requirementLevel !== 'optional'}>
      <TextInput
        value={value}
        disabled={disabled}
        onChange={next => onChange(next ?? '')}
        style={{ width: '100%' }}
      />
    </FormElement>
  );
};
