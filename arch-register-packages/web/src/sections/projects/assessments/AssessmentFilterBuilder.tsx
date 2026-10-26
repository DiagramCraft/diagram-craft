import React from 'react';
import { TbPlus, TbX } from 'react-icons/tb';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { AssessmentField } from '@arch-register/api-types/assessmentContract';
import { getAssessmentEnumOptions } from '@arch-register/api-types/assessmentFieldOptions';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import type { EntitySummary } from '@arch-register/api-types/entityContract';
import styles from '../../../components/FilterBuilder.module.css';
import { EmptyState } from '../../../components/EmptyState';
import { defaultConditionFor, type AssessmentFilterCondition } from './assessmentFilterConditions';

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
  const addCondition = () => {
    onChange([...conditions, defaultConditionFor('_owner', fields)]);
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
        {conditions.length === 0 && <EmptyState compact title="No filters applied." />}
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
              return field?.type === 'enum' ||
                (field?.type === 'derived' && field.resultType === 'select')
                ? getAssessmentEnumOptions(field, enums)
                : [];
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
          <TextInput
            value={condition.value ?? ''}
            onChange={v => onChange({ ...condition, value: v ?? '' })}
          />
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
