import { randomUUID } from 'node:crypto';
import type { SchemaField } from '@arch-register/api-types/schemaContract';
import type {
  SharedFieldGroupDbCreate,
  SharedFieldGroupDbResult,
  SharedFieldGroupDbUpdate,
  SchemaDbResult
} from './db/catalogDatabase';
import { httpAssert } from '../../utils/httpAssert';
import { normalizeSchemaFields } from './schemaHelpers';

const normalizeGroupFields = (fields: unknown): SchemaField[] => {
  const normalized = normalizeSchemaFields(fields).map(field => {
    const { groupId: _groupId, ...withoutGroup } = field;
    return withoutGroup as SchemaField;
  });
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const field of normalized) {
    httpAssert.true(!ids.has(field.id), { message: `Duplicate shared field id '${field.id}'` });
    httpAssert.true(!names.has(field.name.toLowerCase()), {
      message: `Duplicate shared field name '${field.name}'`
    });
    ids.add(field.id);
    names.add(field.name.toLowerCase());
  }
  return normalized;
};

export const buildCreateSharedFieldGroupInput = (
  workspace: string,
  body: Record<string, unknown>,
  timestamp: Date
): SharedFieldGroupDbCreate => {
  const name = body.name;
  httpAssert.string(name, { message: 'name is required and must be a string' });
  return {
    id: randomUUID(),
    workspace,
    name: name.trim(),
    description:
      typeof body.description === 'string' && body.description.trim() !== ''
        ? body.description.trim()
        : null,
    fields: normalizeGroupFields(body.fields ?? []),
    sort_order: typeof body.sort_order === 'number' ? body.sort_order : 0,
    created_at: timestamp,
    updated_at: timestamp
  };
};

export const buildUpdateSharedFieldGroupInput = (
  body: Record<string, unknown>,
  existing: SharedFieldGroupDbResult,
  updatedAt: Date
): SharedFieldGroupDbUpdate => {
  const name = body.name;
  httpAssert.string(name, { message: 'name is required and must be a string' });
  return {
    name: name.trim(),
    description:
      body.description === undefined
        ? existing.description
        : typeof body.description === 'string' && body.description.trim() !== ''
          ? body.description.trim()
          : null,
    fields: body.fields === undefined ? existing.fields : normalizeGroupFields(body.fields),
    sort_order: body.sort_order === undefined ? existing.sort_order : Number(body.sort_order),
    updated_at: updatedAt
  };
};

export const isSharedFieldGroupReferencedBySchemas = (schemas: SchemaDbResult[], groupId: string) =>
  schemas.some(schema =>
    (schema.shared_field_group_links ?? []).some(link => link.groupId === groupId)
  );

export const compileSchemaWithSharedGroups = (
  schema: SchemaDbResult,
  groups: SharedFieldGroupDbResult[]
): SchemaDbResult => {
  const links = schema.shared_field_group_links ?? [];
  const teamIdsByGroupId = new Map(links.map(link => [link.groupId, link.teamIds]));
  const included = links.map(link => {
    const group = groups.find(item => item.id === link.groupId);
    httpAssert.present(group, {
      status: 400,
      message: `Shared fieldgroup '${link.groupId}' not found`
    });
    return group;
  });
  const localFieldIds = new Set<string>();
  for (const field of schema.fields) {
    if (field.groupId && included.some(group => group.id === field.groupId)) continue;
    httpAssert.true(!localFieldIds.has(field.id), {
      status: 400,
      message: `Duplicate schema field id '${field.id}'`
    });
    localFieldIds.add(field.id);
  }
  const fields = schema.fields.filter(field => !included.some(group => field.groupId === group.id));
  const groupNames = new Set<string>();
  const includedById = new Map(included.map(group => [group.id, group]));
  for (const group of schema.groups ?? []) {
    if (!includedById.has(group.id)) groupNames.add(group.name.toLowerCase());
  }
  for (const group of included) {
    httpAssert.true(!groupNames.has(group.name.toLowerCase()), {
      status: 400,
      message: `Duplicate schema group name '${group.name}'`
    });
    groupNames.add(group.name.toLowerCase());
    for (const field of group.fields) {
      httpAssert.true(!localFieldIds.has(field.id), {
        status: 400,
        message: `Shared field '${field.id}' conflicts with a schema field`
      });
      localFieldIds.add(field.id);
      fields.push({ ...field, groupId: group.id });
    }
  }

  const buildSharedGroupEntry = (shared: SharedFieldGroupDbResult) => {
    const teamIds = teamIdsByGroupId.get(shared.id);
    return {
      id: shared.id,
      name: shared.name,
      ...(shared.description ? { description: shared.description } : {}),
      ...(teamIds && teamIds.length > 0 ? { accessControl: { teamIds } } : {})
    };
  };

  const orderedGroups = (schema.groups ?? []).flatMap(group => {
    const shared = includedById.get(group.id);
    if (!shared) return [group];
    return [buildSharedGroupEntry(shared)];
  });
  for (const group of included) {
    if (!orderedGroups.some(item => item.id === group.id)) {
      orderedGroups.push(buildSharedGroupEntry(group));
    }
  }
  return { ...schema, fields, groups: orderedGroups };
};
