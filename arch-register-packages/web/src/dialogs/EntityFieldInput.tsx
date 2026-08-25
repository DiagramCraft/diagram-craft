import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TbX } from 'react-icons/tb';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { EntitySummary } from '@arch-register/api-types/entityContract';
import { MultiValueEditor } from '../components/MultiValueEditor';
import { isMultiValuedScalarField } from '../lib/scalarFieldValues';
import { selectableEnumOptions } from '../utils/enumOptions';
import { Chip } from '../components/Chip';
import { UserGroupPicker } from '../components/UserGroupPicker';
import { usePrincipalLabel } from '../hooks/usePrincipalLabel';

export const EntityFieldInput = ({
  field,
  value,
  onChange,
  referenceOptions,
  currencyOptions,
  defaultCurrency,
  disabled
}: {
  field: EntitySchema['fields'][number];
  value: unknown;
  onChange: (value: unknown) => void;
  referenceOptions?: Record<string, EntitySummary[]>;
  currencyOptions?: Array<{ code: string; label: string }>;
  defaultCurrency?: string;
  disabled?: boolean;
}) => {
  if (field.type === 'reference') {
    const candidates = referenceOptions?.[field.schemaId] ?? [];
    return (
      <FormElement label={field.name} required={field.requirementLevel !== 'optional'}>
        <select
          multiple
          disabled={disabled}
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
          disabled={disabled}
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

  if (isMultiValuedScalarField(field)) {
    const renderItem = (item: unknown, _index: number, update: (value: unknown) => void) => {
      if (field.type === 'select') {
        return (
          <select
            value={typeof item === 'string' ? item : ''}
            disabled={disabled}
            onChange={event => update(event.target.value)}
            style={{ width: '100%' }}
          >
            <option value="">—</option>
            {selectableEnumOptions(field.options, item).map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      }
      if (field.type === 'longtext') {
        return (
          <TextArea
            value={typeof item === 'string' ? item : ''}
            disabled={disabled}
            onChange={next => update(next ?? '')}
            rows={2}
            style={{ width: '100%' }}
          />
        );
      }
      if (field.type === 'boolean') {
        return (
          <select
            value={item === true ? 'true' : item === false ? 'false' : ''}
            disabled={disabled}
            onChange={event => update(event.target.value === 'true')}
            style={{ width: '100%' }}
          >
            <option value="">Not set</option>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        );
      }
      if (field.type === 'date') {
        return (
          <input
            type="date"
            disabled={disabled}
            value={typeof item === 'string' ? item : ''}
            onChange={event => update(event.target.value)}
            style={{ width: '100%' }}
          />
        );
      }
      if (field.type === 'currency') {
        const currencyValue =
          typeof item === 'object' && item !== null && !Array.isArray(item)
            ? (item as { amount?: number; currency?: string })
            : {};
        return (
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="number"
              step="0.01"
              disabled={disabled}
              value={currencyValue.amount ?? ''}
              onChange={event =>
                update({
                  amount: event.target.value === '' ? undefined : Number(event.target.value),
                  currency: currencyValue.currency ?? defaultCurrency ?? 'USD'
                })
              }
              style={{ width: '100%' }}
            />
            <Select.Root
              value={currencyValue.currency ?? defaultCurrency ?? ''}
              disabled={disabled}
              onChange={next =>
                update({ amount: currencyValue.amount, currency: (next ?? '').toUpperCase() })
              }
              placeholder="Currency"
              style={{ width: 110 }}
            >
              {(currencyOptions ?? []).map(currency => (
                <Select.Item key={currency.code} value={currency.code}>
                  {currency.code} — {currency.label}
                </Select.Item>
              ))}
            </Select.Root>
          </div>
        );
      }
      if (field.type === 'number') {
        return (
          <input
            type="number"
            step="1"
            min={field.min}
            max={field.max}
            disabled={disabled}
            value={typeof item === 'number' ? item : ''}
            onChange={event =>
              update(event.target.value === '' ? '' : Math.trunc(event.target.valueAsNumber))
            }
            style={{ width: '100%' }}
          />
        );
      }
      if (field.type === 'principal') {
        return <PrincipalInput value={item} onChange={update} disabled={disabled} />;
      }
      return (
        <TextInput
          value={typeof item === 'string' ? item : ''}
          disabled={disabled}
          onChange={next => update(next ?? '')}
          style={{ width: '100%' }}
        />
      );
    };

    return (
      <FormElement label={field.name} required={field.requirementLevel !== 'optional'}>
        <MultiValueEditor
          value={value}
          onChange={onChange}
          createValue={() =>
            field.type === 'boolean'
              ? false
              : field.type === 'currency'
                ? { amount: undefined, currency: defaultCurrency ?? 'USD' }
                : field.type === 'number'
                  ? ''
                  : ''
          }
          renderItem={renderItem}
        />
      </FormElement>
    );
  }

  if (field.type === 'select') {
    return (
      <FormElement label={field.name} required={field.requirementLevel !== 'optional'}>
        <Select.Root
          value={typeof value === 'string' ? (value ?? undefined) : undefined}
          disabled={disabled}
          onChange={next => onChange(next ?? '')}
          placeholder="—"
          style={{ width: '100%' }}
        >
          {selectableEnumOptions(field.options, value).map(option => (
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
          value={typeof value === 'string' ? (value ?? undefined) : undefined}
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
          value={typeof value === 'string' ? value : ''}
          onChange={event => onChange(event.target.value)}
          style={{ width: '100%' }}
        />
      </FormElement>
    );
  }

  if (field.type === 'currency') {
    const currencyValue =
      typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as { amount?: number; currency?: string })
        : {};
    return (
      <FormElement label={field.name} required={field.requirementLevel !== 'optional'}>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="number"
            step="0.01"
            disabled={disabled}
            value={currencyValue.amount ?? ''}
            onChange={event =>
              onChange({
                amount: event.target.value === '' ? undefined : Number(event.target.value),
                currency: currencyValue.currency ?? defaultCurrency ?? 'USD'
              })
            }
            style={{ width: '100%' }}
          />
          <Select.Root
            value={currencyValue.currency ?? ''}
            disabled={disabled}
            onChange={next =>
              onChange({
                amount: currencyValue.amount,
                currency: (next ?? '').toUpperCase()
              })
            }
            placeholder="Currency"
            style={{ width: 110 }}
          >
            {(currencyOptions ?? []).map(currency => (
              <Select.Item key={currency.code} value={currency.code}>
                {currency.code} — {currency.label}
              </Select.Item>
            ))}
          </Select.Root>
        </div>
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
          value={typeof value === 'string' ? value : ''}
          onChange={event => onChange(event.target.value)}
          style={{ width: '100%' }}
        />
      </FormElement>
    );
  }

  if (field.type === 'principal') {
    return (
      <FormElement label={field.name} required={field.requirementLevel !== 'optional'}>
        <PrincipalInput value={value} onChange={onChange} disabled={disabled} />
      </FormElement>
    );
  }

  return (
    <FormElement label={field.name} required={field.requirementLevel !== 'optional'}>
      <TextInput
        value={typeof value === 'string' ? value : ''}
        disabled={disabled}
        onChange={next => onChange(next ?? '')}
        style={{ width: '100%' }}
      />
    </FormElement>
  );
};

type PrincipalValue = { principal_type?: string; principal_id?: string } | null | undefined;

const PrincipalInput = ({
  value,
  onChange,
  disabled
}: {
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}) => {
  const resolveLabel = usePrincipalLabel();
  const principal = (typeof value === 'object' && value !== null ? value : {}) as PrincipalValue;
  const kind: 'user' | 'team' = principal?.principal_type === 'team' ? 'team' : 'user';

  if (principal?.principal_id) {
    return (
      <Chip tone="ghost">
        <span>{resolveLabel(principal) ?? principal.principal_id}</span>
        {!disabled && (
          <button
            type="button"
            aria-label="Clear"
            onClick={() => onChange(undefined)}
            style={{
              marginLeft: 4,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              padding: 0
            }}
          >
            <TbX size={10} />
          </button>
        )}
      </Chip>
    );
  }

  if (disabled) return <span>—</span>;

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <Select.Root
        value={kind}
        onChange={next => onChange({ principal_type: next ?? 'user', principal_id: '' })}
        placeholder="Type"
        style={{ width: 110 }}
      >
        <Select.Item value="user">User</Select.Item>
        <Select.Item value="team">Team</Select.Item>
      </Select.Root>
      <UserGroupPicker
        kind={kind}
        onSelect={item => onChange({ principal_type: item.kind, principal_id: item.id })}
        placeholder={kind === 'user' ? 'Search users…' : 'Search teams…'}
      />
    </div>
  );
};
