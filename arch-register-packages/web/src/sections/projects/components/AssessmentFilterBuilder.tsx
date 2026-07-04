import React from 'react';
import { TbPlus, TbX } from 'react-icons/tb';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { AssessmentField } from '@arch-register/api-types/assessmentContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import type { EntitySummary } from '@arch-register/api-types/entityContract';
import styles from '../../../components/FilterBuilder.module.css';

export type AssessmentFilterCondition =
  | { fieldId: string; kind: 'rating'; min?: number; max?: number }
  | { fieldId: string; kind: 'enum'; op: 'equals' | 'not_equals' | 'empty'; value?: string }
  | { fieldId: string; kind: 'text'; op: 'contains' | 'empty' | 'not_empty'; value?: string }
  | { fieldId: '_owner'; kind: 'owner'; value?: string }
  | { fieldId: '_schema'; kind: 'schemaType'; value?: string };

const conditionKindForField = (fieldId: string, fields: AssessmentField[]): AssessmentFilterCondition['kind'] => {
  if (fieldId === '_owner') return 'owner';
  if (fieldId === '_schema') return 'schemaType';
  const field = fields.find(f => f.id === fieldId);
  return field?.type ?? 'text';
};

const defaultConditionFor = (fieldId: string, fields: AssessmentField[]): AssessmentFilterCondition => {
  const kind = conditionKindForField(fieldId, fields);
  if (kind === 'rating') return { fieldId, kind: 'rating' };
  if (kind === 'enum') return { fieldId, kind: 'enum', op: 'equals', value: '' };
  if (kind === 'owner') return { fieldId: '_owner', kind: 'owner', value: '' };
  if (kind === 'schemaType') return { fieldId: '_schema', kind: 'schemaType', value: '' };
  return { fieldId, kind: 'text', op: 'contains', value: '' };
};

type Props = {
  conditions: AssessmentFilterCondition[];
  onChange: (conditions: AssessmentFilterCondition[]) => void;
  onClose?: () => void;
  fields: AssessmentField[];
  entities: EntitySummary[];
  schemas: EntitySchema[];
  scope: string[];
  enums: WorkspaceEnum[];
};

export const AssessmentFilterBuilder = ({
  conditions,
  onChange,
  onClose,
  fields,
  entities,
  schemas,
  scope,
  enums
}: Props) => {
  const fieldOptions = React.useMemo(() => {
    const owners = new Map(
      entities.flatMap(e => (e._owner ? [[e._owner.id, e._owner.name] as const] : []))
    );
    return [
      { id: '_owner', name: 'Owner', ownerOptions: [...owners.entries()] },
      {
        id: '_schema',
        name: 'Schema Type',
        schemaOptions: schemas.filter(s => scope.includes(s.id))
      },
      ...fields.map(f => ({ id: f.id, name: f.label }))
    ];
  }, [entities, schemas, scope, fields]);

  const addCondition = () => {
    const first = fieldOptions[0];
    if (!first) return;
    onChange([...conditions, defaultConditionFor(first.id, fields)]);
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

  const updateCondition = (index: number, updated: AssessmentFilterCondition) => {
    const next = [...conditions];
    next[index] = updated;
    onChange(next);
  };

  return (
    <div className={styles.container}>
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
          <AssessmentFilterRow
            key={i}
            condition={c}
            fields={fields}
            entities={entities}
            schemas={schemas}
            scope={scope}
            enums={enums}
            onChange={updated => updateCondition(i, updated)}
            onFieldChange={fieldId => updateCondition(i, defaultConditionFor(fieldId, fields))}
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

const AssessmentFilterRow = ({
  condition,
  fields,
  entities,
  schemas,
  scope,
  enums,
  onChange,
  onFieldChange,
  onRemove
}: {
  condition: AssessmentFilterCondition;
  fields: AssessmentField[];
  entities: EntitySummary[];
  schemas: EntitySchema[];
  scope: string[];
  enums: WorkspaceEnum[];
  onChange: (condition: AssessmentFilterCondition) => void;
  onFieldChange: (fieldId: string) => void;
  onRemove: () => void;
}) => {
  const fieldOptions = React.useMemo(() => {
    return [
      { id: '_owner', name: 'Owner' },
      { id: '_schema', name: 'Schema Type' },
      ...fields.map(f => ({ id: f.id, name: f.label }))
    ];
  }, [fields]);

  const ownerOptions = React.useMemo(() => {
    const owners = new Map(
      entities.flatMap(e => (e._owner ? [[e._owner.id, e._owner.name] as const] : []))
    );
    return [...owners.entries()];
  }, [entities]);

  const schemaOptions = React.useMemo(
    () => schemas.filter(s => scope.includes(s.id)),
    [schemas, scope]
  );

  return (
    <div className={styles.row}>
      <div className={styles.rowHead}>
        <div className={styles.tokField} style={{ width: 140 }}>
          <Select.Root value={condition.fieldId} onChange={v => v && onFieldChange(v)}>
            {fieldOptions.map(f => (
              <Select.Item key={f.id} value={f.id}>
                {f.name}
              </Select.Item>
            ))}
          </Select.Root>
        </div>

        {condition.kind === 'rating' ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <TextInput
              value={condition.min?.toString() ?? ''}
              onChange={v => {
                const n = v ? Number(v) : undefined;
                onChange({ ...condition, min: Number.isFinite(n) ? n : undefined });
              }}
              placeholder="Min"
              style={{ width: 56 }}
            />
            <span>–</span>
            <TextInput
              value={condition.max?.toString() ?? ''}
              onChange={v => {
                const n = v ? Number(v) : undefined;
                onChange({ ...condition, max: Number.isFinite(n) ? n : undefined });
              }}
              placeholder="Max"
              style={{ width: 56 }}
            />
          </div>
        ) : condition.kind === 'enum' ? (
          <div className={styles.tokOp}>
            <Select.Root
              value={condition.op}
              onChange={v =>
                onChange({ ...condition, op: (v as 'equals' | 'not_equals' | 'empty') ?? 'equals' })
              }
            >
              <Select.Item value="equals">Equals</Select.Item>
              <Select.Item value="not_equals">Not equals</Select.Item>
              <Select.Item value="empty">Is empty</Select.Item>
            </Select.Root>
          </div>
        ) : condition.kind === 'text' ? (
          <div className={styles.tokOp}>
            <Select.Root
              value={condition.op}
              onChange={v =>
                onChange({
                  ...condition,
                  op: (v as 'contains' | 'empty' | 'not_empty') ?? 'contains'
                })
              }
            >
              <Select.Item value="contains">Contains</Select.Item>
              <Select.Item value="empty">Is empty</Select.Item>
              <Select.Item value="not_empty">Is not empty</Select.Item>
            </Select.Root>
          </div>
        ) : null}
      </div>

      {condition.kind === 'enum' && condition.op !== 'empty' && (
        <div className={styles.rowBody}>
          <Select.Root value={condition.value} onChange={v => onChange({ ...condition, value: v })}>
            {(() => {
              const field = fields.find(f => f.id === condition.fieldId);
              const enumId = field && field.type === 'enum' ? field.enumId : undefined;
              return enums.find(e => e.id === enumId)?.options ?? [];
            })().map(o => (
              <Select.Item key={o.value} value={o.value}>
                {o.label}
              </Select.Item>
            ))}
          </Select.Root>
        </div>
      )}

      {condition.kind === 'text' && condition.op === 'contains' && (
        <div className={styles.rowBody}>
          <TextInput value={condition.value ?? ''} onChange={v => onChange({ ...condition, value: v ?? '' })} />
        </div>
      )}

      {condition.kind === 'owner' && (
        <div className={styles.rowBody}>
          <Select.Root value={condition.value} onChange={v => onChange({ ...condition, value: v })}>
            {ownerOptions.map(([id, name]) => (
              <Select.Item key={id} value={id}>
                {name}
              </Select.Item>
            ))}
          </Select.Root>
        </div>
      )}

      {condition.kind === 'schemaType' && (
        <div className={styles.rowBody}>
          <Select.Root value={condition.value} onChange={v => onChange({ ...condition, value: v })}>
            {schemaOptions.map(s => (
              <Select.Item key={s.id} value={s.id}>
                {s.name}
              </Select.Item>
            ))}
          </Select.Root>
        </div>
      )}

      <button type="button" className={styles.removeBtn} onClick={onRemove} title="Remove filter">
        <TbX size={11} />
      </button>
    </div>
  );
};

export const matchesAssessmentFilterConditions = (
  entity: EntitySummary,
  values: Record<string, string | number>,
  conditions: AssessmentFilterCondition[]
): boolean =>
  conditions.every(condition => {
    if (condition.kind === 'rating') {
      const value = values[condition.fieldId];
      if (typeof value !== 'number') return false;
      if (condition.min !== undefined && value < condition.min) return false;
      if (condition.max !== undefined && value > condition.max) return false;
      return true;
    }
    if (condition.kind === 'enum') {
      const value = values[condition.fieldId];
      if (condition.op === 'empty') return value === undefined;
      if (value === undefined) return false;
      if (condition.op === 'equals') return String(value) === condition.value;
      return String(value) !== condition.value;
    }
    if (condition.kind === 'text') {
      const value = values[condition.fieldId];
      const str = value === undefined ? '' : String(value);
      if (condition.op === 'empty') return str === '';
      if (condition.op === 'not_empty') return str !== '';
      return str.toLowerCase().includes((condition.value ?? '').toLowerCase());
    }
    if (condition.kind === 'owner') {
      if (!condition.value) return true;
      return entity._owner?.id === condition.value;
    }
    if (condition.kind === 'schemaType') {
      if (!condition.value) return true;
      return entity._schema.id === condition.value;
    }
    return true;
  });
