import React from 'react';
import { TbPlus, TbX } from 'react-icons/tb';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { DateInput } from '@diagram-craft/app-components/DateInput';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import styles from './FilterBuilder.module.css';
import { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  WorkspaceLifecycleState,
  WorkspaceOwnerOption
} from '@arch-register/api-types/workspaceContract';
import { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import { ASSESSMENT_FIELD_PREFIX, ASSESSMENT_PRESENCE_FIELD_ID } from '@arch-register/api-types/assessmentFilter';

const TEXT_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not equals' },
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
  { value: 'not_equals', label: 'Not equals' },
  { value: 'empty', label: 'Is empty' },
  { value: 'not_empty', label: 'Is not empty' }
];

const NUMBER_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not equals' },
  { value: 'gt', label: 'Greater than' },
  { value: 'lt', label: 'Less than' },
  { value: 'empty', label: 'Is empty' },
  { value: 'not_empty', label: 'Is not empty' }
];

const RATING_OPERATORS = [
  { value: 'gte', label: 'At least' },
  { value: 'lte', label: 'At most' },
  { value: 'empty', label: 'Is empty' },
  { value: 'not_empty', label: 'Is not empty' }
];

const PRESENCE_OPERATORS = [
  { value: 'not_empty', label: 'Has response' },
  { value: 'empty', label: 'No response' }
];

type FieldDef = {
  id: string;
  name: string;
  type: 'text' | 'date' | 'select' | 'boolean' | 'number' | 'rating' | 'presence';
  options?: { value: string; label: string }[];
};

type Props = {
  conditions: FilterCondition[];
  onChange: (conditions: FilterCondition[]) => void;
  onClose?: () => void;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  owners: WorkspaceOwnerOption[];
  enums: WorkspaceEnum[];
  selectedSchemaId?: string | null;
  joinedAssessment?: Assessment | null;
};

export const FilterBuilder = ({
  conditions,
  onChange,
  onClose,
  schemas,
  lifecycleStates,
  owners,
  enums,
  selectedSchemaId,
  joinedAssessment
}: Props) => {
  const fields = React.useMemo(() => {
    const builtIn: FieldDef[] = [
      { id: '_name', name: 'Name', type: 'text' },
      { id: '_slug', name: 'Slug', type: 'text' },
      {
        id: '_owner',
        name: 'Owner',
        type: 'select',
        options: owners.map(o => ({ value: o.id, label: o.name }))
      },
      {
        id: '_lifecycle',
        name: 'Status',
        type: 'select',
        options: lifecycleStates.map(s => ({ value: s.id, label: s.label }))
      },
      { id: '_description', name: 'Description', type: 'text' },
      { id: '_namespace', name: 'Namespace', type: 'text' },
      {
        id: '_schemaId',
        name: 'Type',
        type: 'select',
        options: schemas.map(s => ({ value: s.id, label: s.name }))
      }
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
          else if (f.type === 'number') type = 'number';

          return { id: f.id, name: f.name, type, options };
        });
      }
    }

    const assessmentFields: FieldDef[] = joinedAssessment
      ? [
          { id: ASSESSMENT_PRESENCE_FIELD_ID, name: 'Assessment response', type: 'presence' },
          ...joinedAssessment.fields.map((f): FieldDef => {
            const id = `${ASSESSMENT_FIELD_PREFIX}${f.id}`;
            if (f.type === 'rating') return { id, name: f.label, type: 'rating' };
            if (f.type === 'enum') {
              return {
                id,
                name: f.label,
                type: 'select',
                options: enums.find(e => e.id === f.enumId)?.options ?? []
              };
            }
            return { id, name: f.label, type: 'text' };
          })
        ]
      : [];

    return [...builtIn, ...schemaFields, ...assessmentFields];
  }, [schemas, lifecycleStates, owners, enums, selectedSchemaId, joinedAssessment]);

  const addCondition = () => {
    onChange([...conditions, { fieldId: '_name', op: 'contains', value: '' }]);
  };

  const removeCondition = (index: number) => {
    const next = [...conditions];
    next.splice(index, 1);
    onChange(next);
    if (next.length === 0) onClose?.();
  };

  const clearAll = () => {
    onChange([]);
    onClose?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    // Don't close if a Select dropdown is open (it uses Enter to confirm a selection)
    if ((e.target as HTMLElement).closest('[role="listbox"]')) return;
    onClose?.();
  };

  const updateCondition = (index: number, updates: Partial<FilterCondition>) => {
    const next = [...conditions];
    const updated = { ...next[index]!, ...updates };

    // Reset op/value if field changed
    if (updates.fieldId) {
      const field = fields.find(f => f.id === updates.fieldId);
      if (field) {
        if (field.type === 'date') updated.op = 'on';
        else if (field.type === 'select' || field.type === 'number') updated.op = 'equals';
        else if (field.type === 'rating') updated.op = 'gte';
        else if (field.type === 'presence') updated.op = 'not_empty';
        else updated.op = 'contains';
        updated.value = '';
      }
    }

    next[index] = updated;
    onChange(next);
  };

  return (
    <div className={styles.container} onKeyDown={handleKeyDown}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Filters</span>
        {conditions.length > 0 && (
          <button type="button" className={styles.clearAll} onClick={clearAll}>
            Clear all
          </button>
        )}
      </div>

      <div className={styles.rows}>
        {conditions.length === 0 && <div className={styles.emptyState}>No filters applied.</div>}
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

      <div className={styles.footer}>
        <button type="button" className={styles.addFilter} onClick={addCondition}>
          <TbPlus size={11} />
          Add filter
        </button>
      </div>
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

  // Local draft value for text inputs — only committed on Enter to avoid per-keystroke requests
  const [localTextValue, setLocalTextValue] = React.useState(
    (condition.value as string) || ''
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: fieldId is intentional — resets localTextValue when field changes, even if condition.value was already ''
  React.useEffect(() => {
    setLocalTextValue((condition.value as string) || '');
  }, [condition.fieldId, condition.value]);

  const commitTextValue = () => onUpdate({ value: localTextValue });

  const operators = React.useMemo(() => {
    if (field.type === 'date') return DATE_OPERATORS;
    if (field.type === 'select') return SELECT_OPERATORS;
    if (field.type === 'number') return NUMBER_OPERATORS;
    if (field.type === 'rating') return RATING_OPERATORS;
    if (field.type === 'presence') return PRESENCE_OPERATORS;
    return TEXT_OPERATORS;
  }, [field.type]);

  const showValueInput = condition.op !== 'empty' && condition.op !== 'not_empty';

  return (
    <div
      className={styles.row}
      onBlur={e => {
        if (field.type === 'text' && !e.currentTarget.contains(e.relatedTarget as Node)) {
          commitTextValue();
        }
      }}
    >
      <div className={styles.rowHead}>
        <div className={styles.tokField}>
          <Select.Root value={condition.fieldId} onChange={v => onUpdate({ fieldId: v })}>
            {fields.map(f => (
              <Select.Item key={f.id} value={f.id}>
                {f.name}
              </Select.Item>
            ))}
          </Select.Root>
        </div>
        <div className={styles.tokOp}>
          <Select.Root
            value={condition.op}
            onChange={v => onUpdate({ op: v as FilterCondition['op'] })}
          >
            {operators.map(o => (
              <Select.Item key={o.value} value={o.value}>
                {o.label}
              </Select.Item>
            ))}
          </Select.Root>
        </div>
      </div>

      {showValueInput && (
        <div className={styles.rowBody}>
          {field.type === 'select' ? (
            <Select.Root value={condition.value as string} onChange={v => onUpdate({ value: v })}>
              {field.options?.map(o => (
                <Select.Item key={o.value} value={o.value}>
                  {o.label}
                </Select.Item>
              ))}
            </Select.Root>
          ) : field.type === 'date' ? (
            <DateInput
              value={(condition.value as string) || ''}
              onChange={v => onUpdate({ value: v })}
            />
          ) : field.type === 'number' ? (
            <input
              type="number"
              step="1"
              value={(condition.value as string) ?? ''}
              onChange={e => onUpdate({ value: e.target.value })}
            />
          ) : field.type === 'rating' ? (
            <input
              type="number"
              step="1"
              min={1}
              max={5}
              value={(condition.value as string) ?? ''}
              onChange={e => onUpdate({ value: e.target.value ? Number(e.target.value) : '' })}
            />
          ) : (
            <TextInput
              value={localTextValue}
              onChange={v => setLocalTextValue(v ?? '')}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Enter') commitTextValue();
              }}
            />
          )}
        </div>
      )}

      <button type="button" className={styles.removeBtn} onClick={onRemove} title="Remove filter">
        <TbX size={11} />
      </button>
    </div>
  );
};
