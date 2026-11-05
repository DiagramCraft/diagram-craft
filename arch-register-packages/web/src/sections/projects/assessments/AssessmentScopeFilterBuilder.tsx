import React from 'react';
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
import { ListEditor } from '../../../components/ListEditor';
import { Button } from '@diagram-craft/app-components/Button';
import scopeStyles from './AssessmentScopeFilterBuilder.module.css';
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

  return (
    <ListEditor
      label="Filter Conditions"
      items={conditions}
      onChange={onChange}
      createItem={() => {
        const first = fields[0]!;
        return { fieldId: first.id, op: defaultOpForField(first), value: '' };
      }}
      addLabel="Add filter"
      addDisabled={fields.length === 0}
      emptyMessage="No filter conditions"
      layout="row"
      headerActions={
        conditions.length > 0 && (
          <Button size="xs" variant="danger" onClick={() => onChange([])}>
            Clear all
          </Button>
        )
      }
      renderItem={(condition, { replace, remove }) => (
        <div className={scopeStyles.rowContent}>
          <FilterRow
            condition={condition}
            fields={fields}
            onUpdate={updates => replace(applyConditionUpdate(condition, updates, fields))}
            onRemove={remove}
            hideRemove
          />
        </div>
      )}
    />
  );
};
