import React from 'react';
import { TbPlus, TbTrash } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { DateInput } from '@diagram-craft/app-components/DateInput';
import type { FilterCondition } from '@arch-register/api-types/views';
import type {
  EntitySchema,
  WorkspaceLifecycleState,
  WorkspaceOwnerOption,
  WorkspaceEnum
} from '../api';
import styles from './FilterBuilder.module.css';

const TEXT_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'starts_with', label: 'Starts with' },
  { value: 'ends_with', label: 'Ends with' },
  { value: 'empty', label: 'Is empty' },
  { value: 'not_empty', label: 'Is not empty' }
];

const DATE_OPERATORS = [
  { value: 'on', label: 'On' },
  { value: 'before', label: 'Before' },
  { value: 'after', label: 'After' },
  { value: 'empty', label: 'Is empty' },
  { value: 'not_empty', label: 'Is not empty' }
];

const SELECT_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'empty', label: 'Is empty' },
  { value: 'not_empty', label: 'Is not empty' }
];

type FieldDef = {
  id: string;
  name: string;
  type: 'text' | 'date' | 'select' | 'boolean';
  options?: { value: string; label: string }[];
};

type Props = {
  conditions: FilterCondition[];
  onChange: (conditions: FilterCondition[]) => void;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  owners: WorkspaceOwnerOption[];
  enums: WorkspaceEnum[];
  selectedSchemaId?: string | null;
};

export const FilterBuilder = ({
  conditions,
  onChange,
  schemas,
  lifecycleStates,
  owners,
  enums,
  selectedSchemaId
}: Props) => {
  const fields = React.useMemo(() => {
    const builtIn: FieldDef[] = [
      { id: '_name', name: 'Name', type: 'text' },
      { id: '_slug', name: 'Slug', type: 'text' },
      { id: '_owner', name: 'Owner', type: 'select', options: owners.map(o => ({ value: o.id, label: o.id })) },
      { id: '_lifecycle', name: 'Status', type: 'select', options: lifecycleStates.map(s => ({ value: s.id, label: s.label })) },
      { id: '_description', name: 'Description', type: 'text' },
      { id: '_namespace', name: 'Namespace', type: 'text' },
      { id: '_schemaId', name: 'Type', type: 'select', options: schemas.map(s => ({ value: s.id, label: s.name })) }
    ];

    let schemaFields: FieldDef[] = [];
    if (selectedSchemaId) {
      const schema = schemas.find(s => s.id === selectedSchemaId);
      if (schema) {
        schemaFields = schema.fields.map(f => {
          let type: FieldDef['type'] = 'text';
          let options: FieldDef['options'];

          if (f.type === 'date') type = 'date';
          else if (f.type === 'select') {
            type = 'select';
            const en = enums.find(e => e.id === f.enumId);
            options = en?.options ?? [];
          } else if (f.type === 'boolean') type = 'boolean';

          return { id: f.id, name: f.name, type, options };
        });
      }
    }

    return [...builtIn, ...schemaFields];
  }, [schemas, lifecycleStates, owners, enums, selectedSchemaId]);

  const addCondition = () => {
    onChange([...conditions, { fieldId: '_name', op: 'contains', value: '' }]);
  };

  const removeCondition = (index: number) => {
    const next = [...conditions];
    next.splice(index, 1);
    onChange(next);
  };

  const updateCondition = (index: number, updates: Partial<FilterCondition>) => {
    const next = [...conditions];
    const updated = { ...next[index]!, ...updates };
    
    // Reset op/value if field changed
    if (updates.fieldId) {
      const field = fields.find(f => f.id === updates.fieldId);
      if (field) {
        if (field.type === 'date') updated.op = 'on';
        else if (field.type === 'select') updated.op = 'equals';
        else updated.op = 'contains';
        updated.value = '';
      }
    }
    
    next[index] = updated;
    onChange(next);
  };

  return (
    <div className={styles.container}>
      <div className={styles.rows}>
        {conditions.length === 0 && (
          <div className={styles.emptyState}>No filters applied.</div>
        )}
        {conditions.map((c, i) => (
          <FilterRow
            key={i}
            condition={c}
            fields={fields}
            onUpdate={u => updateCondition(i, u)}
            onRemove={() => removeCondition(i)}
          />
        ))}
      </div>
      <Button variant="ghost" size="sm" onClick={addCondition}>
        <TbPlus size={14} style={{ marginRight: 4 }} />
        Add Filter
      </Button>
    </div>
  );
};

const FilterRow = ({
  condition,
  fields,
  onUpdate,
  onRemove
}: {
  condition: FilterCondition;
  fields: FieldDef[];
  onUpdate: (updates: Partial<FilterCondition>) => void;
  onRemove: () => void;
}) => {
  const field = fields.find(f => f.id === condition.fieldId) ?? fields[0]!;
  
  const operators = React.useMemo(() => {
    if (field.type === 'date') return DATE_OPERATORS;
    if (field.type === 'select') return SELECT_OPERATORS;
    return TEXT_OPERATORS;
  }, [field.type]);

  const showValueInput = condition.op !== 'empty' && condition.op !== 'not_empty';

  return (
    <div className={styles.row}>
      <div className={styles.fieldSelect}>
        <Select.Root value={condition.fieldId} onChange={v => onUpdate({ fieldId: v })}>
          {fields.map(f => (
            <Select.Item key={f.id} value={f.id}>
              {f.name}
            </Select.Item>
          ))}
        </Select.Root>
      </div>
      <div className={styles.opSelect}>
        <Select.Root value={condition.op} onChange={v => onUpdate({ op: v as FilterCondition['op'] })}>
          {operators.map(o => (
            <Select.Item key={o.value} value={o.value}>
              {o.label}
            </Select.Item>
          ))}
        </Select.Root>
      </div>
      <div className={styles.valueInput}>
        {showValueInput && (
          field.type === 'select' ? (
            <Select.Root value={condition.value as string} onChange={v => onUpdate({ value: v })}>
              {field.options?.map(o => (
                <Select.Item key={o.value} value={o.value}>
                  {o.label}
                </Select.Item>
              ))}
            </Select.Root>
          ) : field.type === 'date' ? (
            <DateInput value={(condition.value as string) || ''} onChange={v => onUpdate({ value: v })} />
          ) : (
            <TextInput value={(condition.value as string) || ''} onChange={v => onUpdate({ value: v })} />
          )
        )}
      </div>
      <button type="button" className={styles.removeBtn} onClick={onRemove}>
        <TbTrash size={14} />
      </button>
    </div>
  );
};
