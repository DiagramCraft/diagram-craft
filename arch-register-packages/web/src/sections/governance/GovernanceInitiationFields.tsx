import type { GovernanceInitiationField } from '@arch-register/api-types/governanceInitiationFields';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';

export type GovernanceInitiationFieldValues = Record<string, unknown>;

export const GovernanceInitiationFields = ({
  fields,
  enums = [],
  values,
  onChange
}: {
  fields: GovernanceInitiationField[];
  enums?: Array<{ id: string; options: Array<{ value: string; label: string }> }>;
  values: GovernanceInitiationFieldValues;
  onChange: (values: GovernanceInitiationFieldValues) => void;
}) => {
  if (fields.length === 0) return null;

  return (
    <div>
      {fields.map(field => {
        const resolvedField =
          field.type === 'enum' && !field.options && field.enumId
            ? {
                ...field,
                options: enums.find(enumeration => enumeration.id === field.enumId)?.options ?? []
              }
            : field;
        const value = values[field.id];
        const setValue = (next: unknown) => onChange({ ...values, [field.id]: next });
        if (resolvedField.type === 'enum') {
          return (
            <FormElement
              key={field.id}
              label={field.label}
              required={field.requirementLevel === 'required'}
            >
              <Select.Root
                value={typeof value === 'string' ? value : undefined}
                placeholder="Select an option"
                onChange={setValue}
              >
                {(resolvedField.options ?? []).map(option => (
                  <Select.Item key={option.value} value={option.value}>
                    {option.label}
                  </Select.Item>
                ))}
              </Select.Root>
            </FormElement>
          );
        }
        return (
          <FormElement
            key={field.id}
            label={field.label}
            required={field.requirementLevel === 'required'}
          >
            <TextInput
              type={field.type === 'rating' ? 'number' : 'text'}
              value={value == null ? '' : String(value)}
              onChange={next =>
                setValue(
                  field.type === 'rating'
                    ? next == null || next === ''
                      ? null
                      : Number(next)
                    : next
                )
              }
              min={field.type === 'rating' ? 1 : undefined}
              max={field.type === 'rating' ? (field.max ?? 5) : undefined}
              placeholder={field.type === 'rating' ? `1–${field.max ?? 5}` : undefined}
              style={{ width: '100%' }}
            />
          </FormElement>
        );
      })}
    </div>
  );
};
