import React from 'react';
import { TbPlus } from 'react-icons/tb';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import type {
  WorkspaceLifecycleState,
  WorkspaceOwnerOption
} from '@arch-register/api-types/workspaceContract';
import type { FieldGroupAccess, FieldGroupAccessControl } from '@arch-register/permissions';
import { FilterRow, type FieldDef } from '../../components/FilterBuilder';
import { EmptyState } from '../../components/EmptyState';
import { endpointFieldId, RELATION_TYPE_FIELD_ID } from './relationBrowserState';
import styles from '../../components/FilterBuilder.module.css';

type Props = {
  conditions: FilterCondition[];
  onChange: (conditions: FilterCondition[]) => void;
  onClose?: () => void;
  // All relation schemas — the browser has no separate schema picker, so "type" is just another
  // filter condition (see relationBrowserState.ts), and the field list below is built as the union
  // of every relation schema's fields (deduped by field id), not just one — you can filter on any
  // field before narrowing down by Type.
  relationSchemas: RelationSchema[];
  entitySchemas: EntitySchema[];
  enums: WorkspaceEnum[];
  // Owner/lifecycle options for the relation-level _owner/_lifecycle fields (#2708) — pass
  // useTeams(workspaceId).data/useLifecycleStates(workspaceId).data, mirroring FilterBuilder.tsx's
  // entity-level _owner/_lifecycle fields.
  owners?: WorkspaceOwnerOption[];
  lifecycleStates?: WorkspaceLifecycleState[];
  // Resolves a field group's access for the current caller — pass
  // `useWorkspaceAuthorization(workspaceId).getFieldGroupAccess`.
  // Defaults to unrestricted, matching FilterBuilder.tsx's own no-context fallback.
  getFieldGroupAccess?: (accessControl: FieldGroupAccessControl | undefined) => FieldGroupAccess;
};

// Maps an entity schema field (a superset of relation field types — also has reference/containment/
// derived) to a FieldDef, mirroring FilterBuilder.tsx's own entity-schemaFields mapping so endpoint
// entity fields behave identically whether filtered from the entity browser or here.
const entityFieldToFieldDef = (
  f: EntitySchema['fields'][number],
  enums: WorkspaceEnum[]
): FieldDef => {
  let type: FieldDef['type'] = 'text';
  let options: FieldDef['options'];
  if (f.type === 'date') type = 'date';
  else if (f.type === 'select') {
    type = 'select';
    options = enums.find(e => e.id === f.enumId)?.options ?? [];
  } else if (f.type === 'boolean') type = 'boolean';
  else if (f.type === 'number') type = 'number';
  return { id: f.id, name: f.name, type, options };
};

const relationFieldToFieldDef = (
  f: RelationSchema['fields'][number],
  enums: WorkspaceEnum[]
): FieldDef => {
  if (f.type === 'date') return { id: f.id, name: f.name, type: 'date' };
  if (f.type === 'boolean') return { id: f.id, name: f.name, type: 'boolean' };
  if (f.type === 'number') return { id: f.id, name: f.name, type: 'number' };
  if (f.type === 'select') {
    return {
      id: f.id,
      name: f.name,
      type: 'select',
      options: enums.find(e => e.id === f.enumId)?.options ?? []
    };
  }
  // text | longtext
  return { id: f.id, name: f.name, type: 'text' };
};

const isRelationFieldViewable = (
  schema: RelationSchema,
  field: RelationSchema['fields'][number],
  getFieldGroupAccess: (accessControl: FieldGroupAccessControl | undefined) => FieldGroupAccess
): boolean => {
  if (!field.groupId) return true;
  const group = schema.groups.find(g => g.id === field.groupId);
  return getFieldGroupAccess(group?.accessControl) !== 'none';
};

export const RelationFilterBuilder = ({
  conditions,
  onChange,
  onClose,
  relationSchemas,
  entitySchemas,
  enums,
  owners = [],
  lifecycleStates = [],
  getFieldGroupAccess = () => 'edit'
}: Props) => {
  const fields = React.useMemo(() => {
    const typeField: FieldDef = {
      id: RELATION_TYPE_FIELD_ID,
      name: 'Type',
      type: 'select',
      options: relationSchemas.map(schema => ({ value: schema.id, label: schema.name }))
    };

    const ownerField: FieldDef = {
      id: '_owner',
      name: 'Owner',
      type: 'select',
      options: owners.map(o => ({ value: o.id, label: o.name }))
    };

    const lifecycleField: FieldDef = {
      id: '_lifecycle',
      name: 'Lifecycle',
      type: 'select',
      options: lifecycleStates.map(s => ({ value: s.id, label: s.label }))
    };

    // Own fields: the union of every relation schema's fields, deduped by field id — the browser
    // has no schema picker, so filtering must be possible before (or without ever) narrowing to a
    // single Type. Same field-id-collision tradeoff already accepted for endpoint fields below and
    // in the entity FilterBuilder (#2701).
    const seenOwn = new Set<string>();
    const ownFields: FieldDef[] = [];
    for (const schema of relationSchemas) {
      for (const field of schema.fields) {
        if (seenOwn.has(field.id)) continue;
        if (!isRelationFieldViewable(schema, field, getFieldGroupAccess)) continue;
        seenOwn.add(field.id);
        ownFields.push(relationFieldToFieldDef(field, enums));
      }
    }

    // Endpoint entity fields, deduped by field id across every entity schema allowed at either
    // endpoint of any relation schema — same union-and-dedupe approach as own fields above.
    const endpointFields = (direction: 'in' | 'out'): FieldDef[] => {
      const schemaIds = new Set(
        relationSchemas.flatMap(schema => {
          const endpointSchemaIds = (direction === 'in' ? schema.in : schema.out).schemaIds;
          return endpointSchemaIds === 'any'
            ? entitySchemas.map(candidate => candidate.id)
            : endpointSchemaIds;
        })
      );
      const seen = new Set<string>();
      const result: FieldDef[] = [];
      for (const schema of entitySchemas) {
        if (!schemaIds.has(schema.id)) continue;
        for (const field of schema.fields) {
          if (seen.has(field.id)) continue;
          if (field.groupId) {
            const group = schema.groups?.find(g => g.id === field.groupId);
            if (getFieldGroupAccess(group?.accessControl) === 'none') continue;
          }
          seen.add(field.id);
          const def = entityFieldToFieldDef(field, enums);
          result.push({
            ...def,
            id: endpointFieldId(direction, def.id),
            name: `${direction === 'in' ? 'In' : 'Out'}: ${def.name}`
          });
        }
      }
      return result;
    };

    return [
      typeField,
      ownerField,
      lifecycleField,
      ...ownFields,
      ...endpointFields('in'),
      ...endpointFields('out')
    ];
  }, [relationSchemas, entitySchemas, enums, owners, lifecycleStates, getFieldGroupAccess]);

  const addCondition = () => {
    const first = fields[0];
    onChange([
      ...conditions,
      { fieldId: first?.id ?? '', op: first?.type === 'text' ? 'contains' : 'equals', value: '' }
    ]);
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
    if ((e.target as HTMLElement).closest('[role="listbox"]')) return;
    onClose?.();
  };

  const updateCondition = (index: number, updates: Partial<FilterCondition>) => {
    const next = [...conditions];
    const updated = { ...next[index]!, ...updates };

    if (updates.fieldId) {
      const field = fields.find(f => f.id === updates.fieldId);
      if (field) {
        if (field.type === 'date') updated.op = 'on';
        else if (field.type === 'select' || field.type === 'number' || field.type === 'boolean') {
          updated.op = 'equals';
        } else updated.op = 'contains';
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
        {conditions.length === 0 && <EmptyState compact title="No filters applied." />}
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
  );
};
