import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Select } from '@diagram-craft/app-components/Select';

import type { DocumentField, DocumentMetadata } from '@arch-register/api-types/documentContract';

import { isLinkType } from './documentSettingsHelpers';
export const TemplateDefaultInput = ({
  field,
  value,
  onChange
}: {
  field: DocumentField;
  value: DocumentMetadata[string] | undefined;
  onChange: (value: DocumentMetadata[string] | null | undefined) => void;
}) => {
  if (field.type === 'enum') {
    return (
      <Select.Root
        value={typeof value === 'string' ? value : ''}
        onChange={v => onChange(v ?? undefined)}
        placeholder="— none —"
        style={{ width: '100%' }}
      >
        {(field.enumOptions ?? []).map(option => (
          <Select.Item key={option.value} value={option.value}>
            {option.label}
          </Select.Item>
        ))}
      </Select.Root>
    );
  }
  if (field.type === 'boolean') {
    return (
      <Select.Root
        value={typeof value === 'boolean' ? String(value) : ''}
        onChange={v => onChange(v === undefined ? undefined : v === 'true')}
        placeholder="— unset —"
        style={{ width: '100%' }}
      >
        <Select.Item value="true">True</Select.Item>
        <Select.Item value="false">False</Select.Item>
      </Select.Root>
    );
  }
  if (field.type === 'date') {
    return (
      <input
        type="date"
        value={typeof value === 'string' ? value : ''}
        onChange={event => onChange(event.target.value ?? undefined)}
      />
    );
  }
  if (field.type === 'number') {
    return (
      <TextInput
        value={typeof value === 'number' ? String(value) : ''}
        onChange={v => onChange(v === undefined || v === '' ? undefined : Number(v))}
        style={{ width: '100%' }}
      />
    );
  }
  if (isLinkType(field.type)) {
    const links = Array.isArray(value) ? value : [];
    return (
      <TextInput
        value={links.join(', ')}
        placeholder="IDs separated by commas"
        onChange={v =>
          onChange(
            (v ?? '')
              .split(',')
              .map(item => item.trim())
              .filter(Boolean)
          )
        }
        style={{ width: '100%' }}
      />
    );
  }
  return (
    <TextInput
      value={typeof value === 'string' ? value : ''}
      onChange={v => onChange(v ?? undefined)}
      style={{ width: '100%' }}
    />
  );
};
