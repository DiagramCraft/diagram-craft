import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import type {
  WorkspaceLifecycleState,
  WorkspaceOwnerOption
} from '@arch-register/api-types/workspaceContract';
import type { FieldGroupAccess, FieldGroupAccessControl } from '@arch-register/permissions';
import type { FieldDef } from '../../components/FilterBuilder';
import type { PathSchemaScope } from '../entities/components/pathBuilder/pathBuilderState';
import { endpointFieldId, RELATION_TYPE_FIELD_ID } from './relationBrowserState';

// The relation-scoped `FieldDef` list, shared by the relation-browser filter UI (the visual
// `QueryBuilder` with `rootKind="relation"`). Kept separate from any component so it can be reused
// without pulling in React. The browser has no schema picker, so "type" is just another filter
// condition and the field list is the union of every relation schema's fields (deduped by id).

// Maps an entity schema field (a superset of relation field types — also reference/containment/
// derived) to a FieldDef, mirroring FilterBuilder.tsx's entity-schemaFields mapping so endpoint
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

export type RelationFilterFieldDefsParams = {
  relationSchemas: RelationSchema[];
  entitySchemas: EntitySchema[];
  enums: WorkspaceEnum[];
  owners?: WorkspaceOwnerOption[];
  lifecycleStates?: WorkspaceLifecycleState[];
  getFieldGroupAccess?: (accessControl: FieldGroupAccessControl | undefined) => FieldGroupAccess;
};

/**
 * The full `FieldDef` list for a relation-scoped filter row: a `Type` select, relation-level
 * owner/lifecycle, the union of every relation schema's own fields, and the `In:`/`Out:` endpoint
 * entity fields (id-prefixed via `endpointFieldId`).
 */
export const getRelationFilterFieldDefs = ({
  relationSchemas,
  entitySchemas,
  enums,
  owners = [],
  lifecycleStates = [],
  getFieldGroupAccess = () => 'edit'
}: RelationFilterFieldDefsParams): FieldDef[] => {
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
};

/**
 * Terminal `FieldDef`s for a hop chain that has landed back on a relation row (`path: []` at a
 * relation root, or the position right after a `relationBackward` step, #3120) - the union of every
 * in-scope relation schema's own *scalar* fields, deduped by id. `entityRelation` fields are
 * excluded: those are hops (`relationForward`), not terminal values.
 */
export const getRelationOwnFieldDefs = ({
  relationSchemas,
  relationScope = 'any',
  enums,
  getFieldGroupAccess = () => 'edit'
}: {
  relationSchemas: RelationSchema[];
  relationScope?: PathSchemaScope;
  enums: WorkspaceEnum[];
  getFieldGroupAccess?: (accessControl: FieldGroupAccessControl | undefined) => FieldGroupAccess;
}): FieldDef[] => {
  const scoped =
    relationScope === 'any'
      ? relationSchemas
      : relationSchemas.filter(schema => relationScope.includes(schema.id));
  const seen = new Set<string>();
  const result: FieldDef[] = [];
  for (const schema of scoped) {
    for (const field of schema.fields) {
      if (field.type === 'entityRelation') continue;
      if (seen.has(field.id)) continue;
      if (!isRelationFieldViewable(schema, field, getFieldGroupAccess)) continue;
      seen.add(field.id);
      result.push(relationFieldToFieldDef(field, enums));
    }
  }
  return result;
};
