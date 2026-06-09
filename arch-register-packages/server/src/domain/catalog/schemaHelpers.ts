import { randomUUID } from 'node:crypto';
import type { EntitySchema, WorkspaceEnum } from '@arch-register/api-types';
import type { WorkspaceEnumDbResult as InternalWorkspaceEnum } from './db/catalogDatabase';
import { SchemaDbResult as InternalEntitySchema } from './db/catalogDatabase';
import { httpAssert } from '../../utils/httpAssert';

type SchemaMutationPayload = {
  name: string;
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

export const buildCreateSchemaInput = (
  workspace: string,
  body: Record<string, unknown>,
  teamIds: Set<string>,
  timestamp: Date,
  idFactory: () => string = randomUUID
) => {
  const { name, description = '', fields = [], color, icon, default_owner } = body;
  httpAssert.string(name, { message: 'name is required and must be a string' });

  return {
    id: idFactory(),
    workspace,
    name,
    description: typeof description === 'string' ? description : '',
    fields: Array.isArray(fields) ? (fields as InternalEntitySchema['fields']) : [],
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
  const { name, description, fields, color, icon, default_owner } = body;
  httpAssert.string(name, { message: 'name is required and must be a string' });

  return {
    name,
    description:
      description !== undefined
        ? typeof description === 'string'
          ? description
          : ''
        : current.description,
    fields:
      fields !== undefined && Array.isArray(fields)
        ? (fields as InternalEntitySchema['fields'])
        : current.fields,
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
    fields,
    color: schema.color,
    icon: schema.icon,
    entity_count: entityCount,
    created_at: schema.created_at.toISOString(),
    updated_at: schema.updated_at.toISOString()
  };
};
