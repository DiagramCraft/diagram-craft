import { TbArrowBackUp } from 'react-icons/tb';
import { Select } from '@diagram-craft/app-components/Select';
import { DateInput } from '@diagram-craft/app-components/DateInput';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type {
  SupportedCurrency,
  WorkspaceTeam
} from '@arch-register/api-types/workspaceConfigContract';
import { useEntitiesBySchema } from '../../../hooks/useEntities';
import type { BulkEditableField } from './bulkEditFields';
import styles from './BulkEditToolbar.module.css';
import { MultiValueEditor } from '../../../components/MultiValueEditor';
import { isMultiValuedScalarField } from '../../../lib/scalarFieldValues';

export type BulkFieldInputProps = {
  workspaceId: string;
  field: BulkEditableField;
  value: string;
  clearing: boolean;
  teams: WorkspaceTeam[];
  lifecycleStates: WorkspaceLifecycleState[];
  currencyOptions: SupportedCurrency[];
  defaultCurrency: string;
  onValue: (value: string) => void;
  onClearing: (clearing: boolean) => void;
};

export const BulkFieldInput = ({
  workspaceId,
  field,
  value,
  clearing,
  teams,
  lifecycleStates,
  currencyOptions,
  defaultCurrency,
  onValue,
  onClearing
}: BulkFieldInputProps) => {
  const referenceSchemaId =
    field.kind === 'schema' && field.field.type === 'reference' ? field.field.schemaId : undefined;
  const referenceQueries = useEntitiesBySchema(
    workspaceId,
    referenceSchemaId ? [referenceSchemaId] : []
  );
  const referenceCandidates = referenceQueries[0]?.data ?? [];

  if (clearing) {
    return (
      <span className={styles.bulkClearingTag}>
        will clear
        <button
          type="button"
          className={styles.bulkUnclear}
          title="Undo"
          onClick={() => onClearing(false)}
        >
          <TbArrowBackUp size={11} />
        </button>
      </span>
    );
  }

  if (field.kind === 'owner') {
    return (
      <Select.Root value={value} placeholder="No change" onChange={v => onValue(v ?? '')}>
        {teams.map(team => (
          <Select.Item key={team.id} value={team.id}>
            {team.name}
          </Select.Item>
        ))}
      </Select.Root>
    );
  }

  if (field.kind === 'lifecycle') {
    return (
      <Select.Root value={value} placeholder="No change" onChange={v => onValue(v ?? '')}>
        {lifecycleStates.map(state => (
          <Select.Item key={state.id} value={state.id}>
            {state.label}
          </Select.Item>
        ))}
      </Select.Root>
    );
  }

  const schemaField = field.field;

  if (isMultiValuedScalarField(schemaField)) {
    let values: unknown[] = [];
    if (value.trim() !== '') {
      try {
        const parsed: unknown = JSON.parse(value);
        if (Array.isArray(parsed)) values = parsed;
      } catch {
        values = [];
      }
    }

    const renderItem = (item: unknown, _index: number, update: (value: unknown) => void) => {
      if (schemaField.type === 'select') {
        return (
          <select
            value={typeof item === 'string' ? item : ''}
            onChange={event => update(event.target.value)}
          >
            <option value="">—</option>
            {schemaField.options.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      }
      if (schemaField.type === 'boolean') {
        return (
          <Select.Root
            value={item === true ? 'true' : item === false ? 'false' : undefined}
            placeholder="Value"
            onChange={next => update(next === 'true')}
          >
            <Select.Item value="true">Yes</Select.Item>
            <Select.Item value="false">No</Select.Item>
          </Select.Root>
        );
      }
      if (schemaField.type === 'date') {
        return (
          <DateInput value={typeof item === 'string' ? item : ''} onChange={v => update(v ?? '')} />
        );
      }
      if (schemaField.type === 'number') {
        return (
          <input
            type="number"
            step="1"
            min={schemaField.min}
            max={schemaField.max}
            value={typeof item === 'number' ? item : ''}
            onChange={event =>
              update(event.target.value === '' ? '' : Math.trunc(event.target.valueAsNumber))
            }
          />
        );
      }
      if (schemaField.type === 'currency') {
        const currencyValue =
          typeof item === 'object' && item !== null && !Array.isArray(item)
            ? (item as { amount?: number; currency?: string })
            : {};
        return (
          <span style={{ display: 'inline-flex', gap: 6 }}>
            <input
              type="number"
              step="0.01"
              value={currencyValue.amount ?? ''}
              onChange={event =>
                update({
                  amount: event.target.value === '' ? undefined : Number(event.target.value),
                  currency: currencyValue.currency ?? defaultCurrency
                })
              }
              placeholder="Amount"
            />
            <Select.Root
              value={currencyValue.currency ?? defaultCurrency}
              placeholder="Currency"
              onChange={next =>
                update({ amount: currencyValue.amount, currency: (next ?? '').toUpperCase() })
              }
              style={{ width: 130 }}
            >
              {currencyOptions.map(option => (
                <Select.Item key={option.code} value={option.code}>
                  {option.code} — {option.label}
                </Select.Item>
              ))}
            </Select.Root>
          </span>
        );
      }
      if (schemaField.type === 'longtext') {
        return (
          <TextArea value={typeof item === 'string' ? item : ''} onChange={v => update(v ?? '')} />
        );
      }
      return (
        <TextInput value={typeof item === 'string' ? item : ''} onChange={v => update(v ?? '')} />
      );
    };

    return (
      <MultiValueEditor
        value={values}
        onChange={next => onValue(JSON.stringify(next))}
        createValue={() =>
          schemaField.type === 'boolean'
            ? false
            : schemaField.type === 'currency'
              ? { amount: undefined, currency: defaultCurrency }
              : schemaField.type === 'number'
                ? ''
                : ''
        }
        renderItem={renderItem}
        addLabel="Add"
      />
    );
  }

  if (schemaField.type === 'select') {
    return (
      <Select.Root value={value} placeholder="No change" onChange={v => onValue(v ?? '')}>
        {schemaField.options.map(option => (
          <Select.Item key={option.value} value={option.value}>
            {option.label}
          </Select.Item>
        ))}
      </Select.Root>
    );
  }

  if (schemaField.type === 'reference') {
    return (
      <Select.Root value={value} placeholder="No change" onChange={v => onValue(v ?? '')}>
        {referenceCandidates.map(entity => (
          <Select.Item key={entity._uid} value={entity._uid}>
            {entity._name ?? entity._slug}
          </Select.Item>
        ))}
      </Select.Root>
    );
  }

  if (schemaField.type === 'boolean') {
    return (
      <Select.Root value={value} placeholder="No change" onChange={v => onValue(v ?? '')}>
        <Select.Item value="true">Yes</Select.Item>
        <Select.Item value="false">No</Select.Item>
      </Select.Root>
    );
  }

  if (schemaField.type === 'date') {
    return <DateInput value={value} onChange={v => onValue(v ?? '')} />;
  }

  if (schemaField.type === 'number') {
    return (
      <input
        type="number"
        step="1"
        min={schemaField.min}
        max={schemaField.max}
        value={value}
        onChange={e => onValue(e.target.value)}
        placeholder="New value…"
      />
    );
  }

  if (schemaField.type === 'currency') {
    const [amount = '', currency = defaultCurrency] = value.trim().split(/\s+/, 2);
    return (
      <span style={{ display: 'inline-flex', gap: 6 }}>
        <input
          type="number"
          step="0.01"
          value={amount}
          onChange={e => onValue(e.target.value === '' ? '' : `${e.target.value} ${currency}`)}
          placeholder="Amount"
        />
        <Select.Root
          value={currency}
          placeholder="Currency"
          onChange={next => onValue(amount ? `${amount} ${(next ?? '').toUpperCase()}` : '')}
          style={{ width: 130 }}
        >
          {currencyOptions.map(option => (
            <Select.Item key={option.code} value={option.code}>
              {option.code} — {option.label}
            </Select.Item>
          ))}
        </Select.Root>
      </span>
    );
  }

  if (schemaField.type === 'longtext') {
    return <TextArea value={value} onChange={v => onValue(v ?? '')} placeholder="New value…" />;
  }

  return <TextInput value={value} onChange={v => onValue(v ?? '')} placeholder="New value…" />;
};
