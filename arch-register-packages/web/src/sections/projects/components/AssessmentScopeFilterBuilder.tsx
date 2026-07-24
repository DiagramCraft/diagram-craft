import React from 'react';
import { TbPlus, TbX } from 'react-icons/tb';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import styles from '../../../components/FilterBuilder.module.css';
import scopeStyles from './AssessmentScopeFilterBuilder.module.css';
import { EmptyState } from '../../../components/EmptyState';

type ScopeField = {
  id: string;
  name: string;
  type: 'text' | 'select' | 'number' | 'boolean';
  options?: { value: string; label: string }[];
};

const BASE_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not equals' },
  { value: 'empty', label: 'Is empty' },
  { value: 'not_empty', label: 'Is not empty' }
] as const;

const TEXT_OPERATORS = [{ value: 'contains', label: 'Contains' }, ...BASE_OPERATORS] as const;

const defaultOpFor = (field: ScopeField): FilterCondition['op'] =>
  field.type === 'text' ? 'contains' : 'equals';

const normalizeValue = (field: ScopeField, value: string): unknown => {
  if (field.type === 'number' || field.type === 'boolean') return value;
  return value;
};

const customFieldType = (field: EntitySchema['fields'][number]): ScopeField['type'] => {
  if (field.type === 'select') return 'select';
  if (field.type === 'number') return 'number';
  if (field.type === 'boolean') return 'boolean';
  return 'text';
};

const customFieldOptions = (field: EntitySchema['fields'][number]) => {
  if (field.type === 'select') return field.options;
  if (field.type === 'boolean') {
    return [
      { value: 'true', label: 'True' },
      { value: 'false', label: 'False' }
    ];
  }
  return undefined;
};

const useScopeFields = ({
  schemas,
  scope,
  lifecycleStates,
  teams
}: {
  schemas: EntitySchema[];
  scope: string[];
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
}) =>
  React.useMemo(() => {
    const fields: ScopeField[] = [
      {
        id: '_owner',
        name: 'Owner',
        type: 'select',
        options: teams.map(team => ({ value: team.id, label: team.name }))
      },
      {
        id: '_lifecycle',
        name: 'Lifecycle',
        type: 'select',
        options: lifecycleStates.map(state => ({ value: state.id, label: state.label }))
      },
      { id: '_namespace', name: 'Namespace', type: 'text' },
      { id: '_tags', name: 'Tags', type: 'text' }
    ];

    const customFields = new Map<string, ScopeField>();
    for (const schema of schemas.filter(schema => scope.includes(schema.id))) {
      for (const field of schema.fields) {
        if (field.type === 'reference' || field.type === 'containment') continue;
        if (customFields.has(field.id)) continue;
        customFields.set(field.id, {
          id: field.id,
          name: field.name,
          type: customFieldType(field),
          options: customFieldOptions(field)
        });
      }
    }

    return [...fields, ...customFields.values()];
  }, [schemas, scope, lifecycleStates, teams]);

export const AssessmentScopeFilterBuilder = ({
  conditions,
  onChange,
  schemas,
  scope,
  lifecycleStates,
  teams
}: {
  conditions: FilterCondition[];
  onChange: (conditions: FilterCondition[]) => void;
  schemas: EntitySchema[];
  scope: string[];
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
}) => {
  const fields = useScopeFields({ schemas, scope, lifecycleStates, teams });

  const addCondition = () => {
    const first = fields[0];
    if (!first) return;
    onChange([...conditions, { fieldId: first.id, op: defaultOpFor(first), value: '' }]);
  };

  const updateCondition = (index: number, updates: Partial<FilterCondition>) => {
    const next = [...conditions];
    const updated = { ...next[index]!, ...updates };
    if (updates.fieldId) {
      const field = fields.find(f => f.id === updates.fieldId);
      if (field) {
        updated.op = defaultOpFor(field);
        updated.value = '';
      }
    }
    next[index] = updated;
    onChange(next);
  };

  const removeCondition = (index: number) => {
    const next = [...conditions];
    next.splice(index, 1);
    onChange(next);
  };

  const clearAll = () => onChange([]);

  return (
    <div className={scopeStyles.panel}>
      <div className={scopeStyles.header}>
        <div>
          <div className={scopeStyles.title}>Filter Conditions</div>
        </div>
        <div className={scopeStyles.actions}>
          {conditions.length > 0 && (
            <button type="button" className={styles.addFilter} onClick={clearAll}>
              Clear all
            </button>
          )}
          <button
            type="button"
            className={styles.addFilter}
            onClick={addCondition}
            disabled={fields.length === 0}
          >
            <TbPlus size={11} />
            Add filter
          </button>
        </div>
      </div>

      <div className={styles.rows}>
        {conditions.length === 0 && <EmptyState compact title="No filter conditions." />}
        {conditions.map((condition, index) => (
          <AssessmentScopeFilterRow
            key={index}
            condition={condition}
            fields={fields}
            onUpdate={updates => updateCondition(index, updates)}
            onRemove={() => removeCondition(index)}
          />
        ))}
      </div>
    </div>
  );
};

const AssessmentScopeFilterRow = ({
  condition,
  fields,
  onUpdate,
  onRemove
}: {
  condition: FilterCondition;
  fields: ScopeField[];
  onUpdate: (updates: Partial<FilterCondition>) => void;
  onRemove: () => void;
}) => {
  const field = fields.find(f => f.id === condition.fieldId) ?? fields[0]!;
  const operators = field.type === 'text' ? TEXT_OPERATORS : BASE_OPERATORS;
  const showValueInput = condition.op !== 'empty' && condition.op !== 'not_empty';

  return (
    <div className={styles.row}>
      <div className={styles.rowHead}>
        <div className={styles.tokField}>
          <Select.Root value={condition.fieldId} onChange={value => onUpdate({ fieldId: value })}>
            {fields.map(option => (
              <Select.Item key={option.id} value={option.id}>
                {option.name}
              </Select.Item>
            ))}
          </Select.Root>
        </div>
        <div className={styles.tokOp}>
          <Select.Root
            value={condition.op}
            onChange={value => onUpdate({ op: value as FilterCondition['op'] })}
          >
            {operators.map(operator => (
              <Select.Item key={operator.value} value={operator.value}>
                {operator.label}
              </Select.Item>
            ))}
          </Select.Root>
        </div>
      </div>

      {showValueInput && (
        <div className={styles.rowBody}>
          {field.type === 'select' || field.type === 'boolean' ? (
            <Select.Root
              value={String(condition.value ?? '')}
              onChange={value => onUpdate({ value: normalizeValue(field, value ?? '') })}
            >
              {field.options?.map(option => (
                <Select.Item key={option.value} value={option.value}>
                  {option.label}
                </Select.Item>
              ))}
            </Select.Root>
          ) : field.type === 'number' ? (
            <input
              type="number"
              value={String(condition.value ?? '')}
              onChange={event => onUpdate({ value: normalizeValue(field, event.target.value) })}
            />
          ) : (
            <TextInput
              value={String(condition.value ?? '')}
              onChange={value => onUpdate({ value: value ?? '' })}
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
