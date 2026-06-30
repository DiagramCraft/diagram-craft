import { randomUUID } from 'node:crypto';
import type { WorkspaceEnumDbResult as InternalWorkspaceEnum } from './db/catalogDatabase';
import { SchemaDbResult as InternalEntitySchema } from './db/catalogDatabase';
import { httpAssert } from '../../utils/httpAssert';
import { EntitySchema, SchemaField } from '@arch-register/api-types/schemaContract';
import { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import { normalizePublicIdPrefix, validatePublicIdPrefix } from '../../utils/publicIds';

type SchemaMutationPayload = {
  name: string;
  key_prefix: string;
  description: string;
  fields: InternalEntitySchema['fields'];
  color: string | null;
  icon: string | null;
  defaultOwner: string | null;
};

export const resolveSchemaDefaultOwner = (
  requestedOwner: unknown,
  teamIds: Set<string>,
  fallbackOwner: string | null = null
) =>
  typeof requestedOwner === 'string' && teamIds.has(requestedOwner)
    ? requestedOwner
    : fallbackOwner;

const defaultKeyPrefixFromName = (name: string) =>
  normalizePublicIdPrefix(name.replace(/[^a-z]/gi, '').slice(0, 5) || name.slice(0, 5));

const normalizeSchemaFields = (fields: unknown): InternalEntitySchema['fields'] => {
  if (!Array.isArray(fields)) return [];

  return fields.map(field => {
    httpAssert.json(field, { message: 'Schema fields must be objects' });

    if (field.type === 'containment') {
      httpAssert.true(field.maxCount === 1, {
        message: 'Containment fields must have maxCount set to 1'
      });
      httpAssert.true(field.minCount === 0 || field.minCount === 1, {
        message: 'Containment fields must have minCount set to 0 or 1'
      });
    }

    return field as InternalEntitySchema['fields'][number];
  });
};

export const buildCreateSchemaInput = (
  workspace: string,
  body: Record<string, unknown>,
  teamIds: Set<string>,
  timestamp: Date,
  idFactory: () => string = randomUUID
) => {
  const { name, key_prefix, description = '', fields = [], color, icon, default_owner } = body;
  httpAssert.string(name, { message: 'name is required and must be a string' });

  return {
    id: idFactory(),
    workspace,
    name,
    key_prefix:
      key_prefix !== undefined
        ? validatePublicIdPrefix(key_prefix, 'key_prefix')!
        : validatePublicIdPrefix(defaultKeyPrefixFromName(name), 'key_prefix')!,
    description: typeof description === 'string' ? description : '',
    fields: normalizeSchemaFields(fields),
    color: typeof color === 'string' ? color : null,
    icon: typeof icon === 'string' ? icon : null,
    default_owner: resolveSchemaDefaultOwner(default_owner, teamIds, null),
    created_at: timestamp,
    updated_at: timestamp
  };
};

export const buildUpdateSchemaInput = (
  body: Record<string, unknown>,
  current: InternalEntitySchema,
  teamIds: Set<string>,
  timestamp: Date
): SchemaMutationPayload & { updated_at: Date } => {
  const { name, key_prefix, description, fields, color, icon, default_owner } = body;
  httpAssert.string(name, { message: 'name is required and must be a string' });

  return {
    name,
    key_prefix:
      key_prefix !== undefined
        ? validatePublicIdPrefix(key_prefix, 'key_prefix')!
        : current.key_prefix,
    description:
      description !== undefined
        ? typeof description === 'string'
          ? description
          : ''
        : current.description,
    fields: fields !== undefined ? normalizeSchemaFields(fields) : current.fields,
    color: color !== undefined ? (typeof color === 'string' ? color : null) : current.color,
    icon: icon !== undefined ? (typeof icon === 'string' ? icon : null) : current.icon,
    defaultOwner:
      default_owner !== undefined
        ? resolveSchemaDefaultOwner(default_owner, teamIds, null)
        : current.default_owner,
    updated_at: timestamp
  };
};

export const isSchemaReferencedByEntities = (
  schemaId: string,
  entities: Array<{ schema_id: string }>
) => entities.some(entity => entity.schema_id === schemaId);

const isRequired = (field: SchemaField) => field.requirementLevel === 'required';

/**
 * Detects schema field changes that would be incompatible with entity data that
 * already exists for the schema (e.g. silently orphaning data stored under an old
 * field id, or invalidating data for a field newly marked as required).
 *
 * Fields are matched primarily by id. An old field whose id disappears and a new
 * field with the same name are treated as the same field having its id changed,
 * since that's how the schema editor represents an in-place id edit.
 */
export const findIncompatibleFieldChanges = (oldFields: SchemaField[], newFields: SchemaField[]): string[] => {
  const messages: string[] = [];
  const newById = new Map(newFields.map(field => [field.id, field]));

  const unmatchedOld: SchemaField[] = [];
  for (const oldField of oldFields) {
    const newField = newById.get(oldField.id);
    if (!newField) {
      unmatchedOld.push(oldField);
      continue;
    }
    if (oldField.type !== newField.type) {
      messages.push(`Field "${oldField.name}" cannot change type (${oldField.type} → ${newField.type})`);
    }
    if (!isRequired(oldField) && isRequired(newField)) {
      messages.push(`Field "${oldField.name}" cannot be made required while entities exist`);
    }
  }

  const matchedIds = new Set(oldFields.map(field => field.id).filter(id => newById.has(id)));
  const unmatchedNew = newFields.filter(field => !matchedIds.has(field.id));

  const renamedIds = new Set<string>();
  for (const oldField of unmatchedOld) {
    const renamedTo = unmatchedNew.find(field => field.name === oldField.name && !renamedIds.has(field.id));
    if (renamedTo) {
      renamedIds.add(renamedTo.id);
      messages.push(`Field "${oldField.name}" cannot have its id changed (${oldField.id} → ${renamedTo.id})`);
    }
  }

  for (const newField of unmatchedNew) {
    if (renamedIds.has(newField.id)) continue;
    if (isRequired(newField)) {
      messages.push(`New field "${newField.name}" cannot be required while entities exist`);
    }
  }

  return messages;
};

export const toApiEnum = (e: InternalWorkspaceEnum): WorkspaceEnum => ({
  id: e.id,
  workspace: e.workspace,
  name: e.name,
  options: e.options,
  sort_order: e.sort_order,
  created_at: e.created_at.toISOString(),
  updated_at: e.updated_at.toISOString()
});

export const toApiSchema = (
  schema: InternalEntitySchema,
  entityCount: number,
  enums: InternalWorkspaceEnum[]
): EntitySchema => {
  const enumMap = new Map(enums.map(e => [e.id, e]));
  const fields = schema.fields.map(field => {
    if (field.type === 'select') {
      const enumDef = enumMap.get(field.enumId);
      return {
        ...field,
        options: enumDef?.options ?? []
      };
    }
    return field;
  });
  return {
    id: schema.id,
    workspace: schema.workspace,
    name: schema.name,
    description: schema.description,
    key_prefix: schema.key_prefix,
    fields,
    color: schema.color,
    icon: schema.icon,
    entity_count: entityCount,
    created_at: schema.created_at.toISOString(),
    updated_at: schema.updated_at.toISOString()
  };
};
