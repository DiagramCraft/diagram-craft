import React from 'react';
import { TbPlus } from 'react-icons/tb';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { isRelationLikeField } from '@arch-register/api-types/schemaContract';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import {
  FilterRow,
  applyConditionUpdate,
  defaultOpForField,
  type FieldDef
} from '../../../components/FilterBuilder';
import styles from '../../../components/FilterBuilder.module.css';
import scopeStyles from './AssessmentScopeFilterBuilder.module.css';
import { EmptyState } from '../../../components/EmptyState';
import type { FieldGroupAccess, FieldGroupAccessControl } from '@arch-register/permissions';

const customFieldType = (field: EntitySchema['fields'][number]): FieldDef['type'] => {
  // Booleans are picked from a true/false list, like selects
  if (field.type === 'select' || field.type === 'boolean') return 'select';
  if (field.type === 'number') return 'number';
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
  teams,
  getFieldGroupAccess
}: {
  schemas: EntitySchema[];
  scope: string[];
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  getFieldGroupAccess: (accessControl: FieldGroupAccessControl | undefined) => FieldGroupAccess;
}) =>
  React.useMemo(() => {
    const fields: FieldDef[] = [
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

    const customFields = new Map<string, FieldDef>();
    for (const schema of schemas.filter(schema => scope.includes(schema.id))) {
      for (const field of schema.fields) {
        if (isRelationLikeField(field)) continue;
        if (customFields.has(field.id)) continue;
        if (field.groupId) {
          const group = schema.groups?.find(g => g.id === field.groupId);
          if (getFieldGroupAccess(group?.accessControl) === 'none') continue;
        }
        customFields.set(field.id, {
          id: field.id,
          name: field.name,
          type: customFieldType(field),
          options: customFieldOptions(field)
        });
      }
    }

    return [...fields, ...customFields.values()];
  }, [schemas, scope, lifecycleStates, teams, getFieldGroupAccess]);

export const AssessmentScopeFilterBuilder = ({
  conditions,
  onChange,
  schemas,
  scope,
  lifecycleStates,
  teams,
  getFieldGroupAccess = () => 'edit'
}: {
  conditions: FilterCondition[];
  onChange: (conditions: FilterCondition[]) => void;
  schemas: EntitySchema[];
  scope: string[];
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  // Resolves a field group's access for the current caller — pass
  // `useWorkspaceAuthorization(workspaceId).getFieldGroupAccess`.
  // Defaults to unrestricted (matches the hook's own no-context fallback) so this stays a pure,
  // presentational component usable without an auth context (e.g. in Storybook).
  getFieldGroupAccess?: (accessControl: FieldGroupAccessControl | undefined) => FieldGroupAccess;
}) => {
  const fields = useScopeFields({ schemas, scope, lifecycleStates, teams, getFieldGroupAccess });

  const addCondition = () => {
    const first = fields[0];
    if (!first) return;
    onChange([...conditions, { fieldId: first.id, op: defaultOpForField(first), value: '' }]);
  };

  const updateCondition = (index: number, updates: Partial<FilterCondition>) => {
    const next = [...conditions];
    next[index] = applyConditionUpdate(next[index]!, updates, fields);
    onChange(next);
  };

  const removeCondition = (index: number) => onChange(conditions.filter((_, i) => i !== index));

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
          <FilterRow
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
