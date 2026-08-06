import { randomUUID } from 'node:crypto';
import type {
  RelationSchemaDbResult as InternalRelationSchema,
  RelationSchemaGroupDbShape,
  RelationSchemaVersionDbResult
} from './db/relationDatabase';
import type { SharedFieldGroupDbResult } from './db/catalogDatabase';
import { httpAssert } from '../../utils/httpAssert';
import {
  clearOrphanedGroupIds,
  normalizeSchemaGroups,
  normalizeSharedFieldGroupLinks,
  resolveSelectFieldOptions
} from './schemaHelpers';
import type { WorkspaceEnumDbResult as InternalWorkspaceEnum } from './db/catalogDatabase';
import {
  RelationField,
  RelationSchema,
  RelationSchemaVersion
} from '@arch-register/api-types/relationSchemaContract';
import {
  FieldMigrations,
  SchemaField,
  SharedFieldGroupLink
} from '@arch-register/api-types/schemaContract';

// resolveSelectFieldOptions/classifyFieldChanges (schemaHelpers.ts) are typed against entity
// SchemaField[] but are fully generic at runtime — they only inspect id/name/type/enumId/
// resultType/archived/groupId, none of which differ in shape between the two field unions except
// for the relation-only `entityRelation` variant they never branch on. Safe to reuse via this cast
// rather than duplicating either helper for relation schemas.
export const asSchemaFields = (fields: RelationField[]): SchemaField[] =>
  fields as unknown as SchemaField[];

const normalizeRelationEndpoint = (
  value: unknown,
  label: 'in' | 'out',
  knownEntitySchemaIds: Set<string>
): { schemaIds: string[] } => {
  httpAssert.json(value, { message: `"${label}" endpoint is required and must be an object` });
  const schemaIds = (value as Record<string, unknown>).schemaIds;
  httpAssert.true(Array.isArray(schemaIds) && schemaIds.length > 0, {
    message: `"${label}.schemaIds" must be a non-empty array`
  });
  const ids = [
    ...new Set((schemaIds as unknown[]).filter((id): id is string => typeof id === 'string'))
  ];
  httpAssert.true(ids.length > 0, {
    message: `"${label}.schemaIds" must contain at least one entity schema identifier`
  });
  for (const id of ids) {
    httpAssert.true(knownEntitySchemaIds.has(id), {
      message: `"${label}" endpoint references unknown entity schema '${id}'`
    });
  }
  return { schemaIds: ids };
};

export const normalizeRelationFields = (fields: unknown): RelationField[] => {
  if (!Array.isArray(fields)) return [];
  return fields.map(field => {
    httpAssert.json(field, { message: 'Relation fields must be objects' });
    if (field.type === 'number' && field.min !== undefined && field.max !== undefined) {
      httpAssert.true(field.min <= field.max, {
        message: 'Number field min must be less than or equal to max'
      });
    }
    return field as RelationField;
  });
};

export const buildCreateRelationSchemaInput = (
  workspace: string,
  body: Record<string, unknown>,
  knownEntitySchemaIds: Set<string>,
  timestamp: Date,
  idFactory: () => string = randomUUID
) => {
  const {
    name,
    description = '',
    in: inEndpoint,
    out: outEndpoint,
    fields = [],
    groups = [],
    shared_field_group_links = [],
    color,
    icon,
    relation_approval_policy
  } = body;
  httpAssert.string(name, { message: 'name is required and must be a string' });
  httpAssert.true(relation_approval_policy !== 'required', {
    status: 400,
    message:
      'relation_approval_policy "required" is not yet supported (see #2574); use "disabled" for now'
  });

  const normalizedGroups = normalizeSchemaGroups(groups) as RelationSchemaGroupDbShape[];
  const normalizedFields = clearOrphanedGroupIds(normalizeRelationFields(fields), normalizedGroups);

  return {
    id: idFactory(),
    workspace,
    name,
    description: typeof description === 'string' ? description : '',
    in_schema_ids: normalizeRelationEndpoint(inEndpoint, 'in', knownEntitySchemaIds).schemaIds,
    out_schema_ids: normalizeRelationEndpoint(outEndpoint, 'out', knownEntitySchemaIds).schemaIds,
    fields: normalizedFields,
    groups: normalizedGroups,
    shared_field_group_links: normalizeSharedFieldGroupLinks(shared_field_group_links),
    color: typeof color === 'string' ? color : null,
    icon: typeof icon === 'string' ? icon : null,
    relation_approval_policy: 'disabled' as const,
    created_at: timestamp,
    updated_at: timestamp
  };
};

export const buildUpdateRelationSchemaInput = (
  body: Record<string, unknown>,
  current: InternalRelationSchema,
  knownEntitySchemaIds: Set<string>,
  timestamp: Date
) => {
  const {
    name,
    description,
    in: inEndpoint,
    out: outEndpoint,
    fields,
    groups,
    shared_field_group_links,
    color,
    icon,
    relation_approval_policy
  } = body;
  httpAssert.string(name, { message: 'name is required and must be a string' });
  httpAssert.true(relation_approval_policy !== 'required', {
    status: 400,
    message:
      'relation_approval_policy "required" is not yet supported (see #2574); use "disabled" for now'
  });

  const normalizedGroups =
    groups !== undefined
      ? (normalizeSchemaGroups(groups) as RelationSchemaGroupDbShape[])
      : (current.groups ?? []);
  const rawFields = fields !== undefined ? normalizeRelationFields(fields) : current.fields;
  const normalizedFields = clearOrphanedGroupIds(rawFields, normalizedGroups);

  return {
    name,
    description:
      description !== undefined
        ? typeof description === 'string'
          ? description
          : ''
        : current.description,
    in_schema_ids:
      inEndpoint !== undefined
        ? normalizeRelationEndpoint(inEndpoint, 'in', knownEntitySchemaIds).schemaIds
        : current.in_schema_ids,
    out_schema_ids:
      outEndpoint !== undefined
        ? normalizeRelationEndpoint(outEndpoint, 'out', knownEntitySchemaIds).schemaIds
        : current.out_schema_ids,
    fields: normalizedFields,
    groups: normalizedGroups,
    shared_field_group_links:
      groups !== undefined
        ? normalizeSharedFieldGroupLinks(shared_field_group_links)
        : (current.shared_field_group_links ?? []),
    color: color !== undefined ? (typeof color === 'string' ? color : null) : current.color,
    icon: icon !== undefined ? (typeof icon === 'string' ? icon : null) : current.icon,
    relation_approval_policy: (current.relation_approval_policy ?? 'disabled') as
      | 'required'
      | 'disabled',
    updated_at: timestamp
  };
};

/**
 * Duplicates (rather than reuses) `compileSchemaWithSharedGroups` from fieldGroupHelpers.ts:
 * that function is typed against `SchemaDbResult`, which requires entity-only fields (key_prefix,
 * templates, default_owner, ...) that RelationSchema intentionally doesn't have. The compilation
 * logic itself is identical.
 */
export const compileRelationSchemaWithSharedGroups = (
  schema: InternalRelationSchema,
  sharedGroups: SharedFieldGroupDbResult[]
): InternalRelationSchema => {
  const links = schema.shared_field_group_links ?? [];
  const teamIdsByGroupId = new Map(links.map(link => [link.groupId, link.teamIds]));
  const included = links.map(link => {
    const group = sharedGroups.find(item => item.id === link.groupId);
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
      message: `Duplicate relation field id '${field.id}'`
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
      message: `Duplicate relation group name '${group.name}'`
    });
    groupNames.add(group.name.toLowerCase());
    for (const field of group.fields) {
      httpAssert.true(!localFieldIds.has(field.id), {
        status: 400,
        message: `Shared field '${field.id}' conflicts with a relation field`
      });
      localFieldIds.add(field.id);
      // Shared field groups only carry non-relational scalar field types today, so this cast is
      // safe; a shared group cannot smuggle in reference/containment/derived fields.
      fields.push({ ...field, groupId: group.id } as RelationField);
    }
  }

  const buildSharedGroupEntry = (shared: SharedFieldGroupDbResult): RelationSchemaGroupDbShape => {
    const teamIds = teamIdsByGroupId.get(shared.id);
    return {
      id: shared.id,
      name: shared.name,
      ...(shared.description ? { description: shared.description } : {}),
      ...(teamIds && teamIds.length > 0 ? { accessControl: { teamIds } } : {})
    };
  };

  const orderedGroups: RelationSchemaGroupDbShape[] = (schema.groups ?? []).flatMap(group => {
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

export const toApiRelationSchema = (
  schema: InternalRelationSchema,
  relationCount: number,
  enums: InternalWorkspaceEnum[]
): RelationSchema => {
  const fields = resolveSelectFieldOptions(
    asSchemaFields(schema.fields),
    enums
  ) as RelationSchema['fields'];
  return {
    id: schema.id,
    workspace: schema.workspace,
    name: schema.name,
    description: schema.description,
    in: { schemaIds: schema.in_schema_ids },
    out: { schemaIds: schema.out_schema_ids },
    fields,
    groups: (schema.groups ?? []) as RelationSchema['groups'],
    shared_field_group_links: schema.shared_field_group_links ?? [],
    color: schema.color,
    icon: schema.icon,
    relation_count: relationCount,
    version: schema.version ?? 1,
    relation_approval_policy: schema.relation_approval_policy ?? 'disabled',
    created_at: schema.created_at.toISOString(),
    updated_at: schema.updated_at.toISOString()
  };
};

/** Reuses the generic (field id/name/archived-based) summary logic from schemaHelpers.ts. */
export const buildRelationSchemaChangeSummary = (
  oldFields: RelationField[] | null,
  newFields: RelationField[],
  fieldMigrations?: FieldMigrations
): Record<string, unknown> => {
  if (!oldFields) return { added: newFields.map(field => field.name) };

  const oldById = new Map(oldFields.map(field => [field.id, field]));
  const newById = new Map(newFields.map(field => [field.id, field]));

  const added: string[] = [];
  const removed: string[] = [];
  const renamed: Array<{ from: string; to: string }> = [];
  const archived: string[] = [];

  for (const field of newFields) {
    if (!oldById.has(field.id)) added.push(field.name);
  }
  for (const field of oldFields) {
    if (newById.has(field.id)) continue;
    const migration = fieldMigrations?.[field.id];
    if (migration?.action === 'rename' && migration.renameTo) {
      const target = newById.get(migration.renameTo);
      renamed.push({ from: field.name, to: target?.name ?? migration.renameTo });
    } else {
      removed.push(field.name);
    }
  }
  for (const field of newFields) {
    const previous = oldById.get(field.id);
    if (previous && !previous.archived && field.archived) archived.push(field.name);
  }

  const summary: Record<string, unknown> = {};
  if (added.length) summary.added = added;
  if (removed.length) summary.removed = removed;
  if (renamed.length) summary.renamed = renamed;
  if (archived.length) summary.archived = archived;
  return summary;
};

export const toApiRelationSchemaVersion = (
  row: RelationSchemaVersionDbResult,
  enums: InternalWorkspaceEnum[]
): RelationSchemaVersion => ({
  version: row.version,
  name: row.name,
  description: row.description,
  in: { schemaIds: row.in_schema_ids },
  out: { schemaIds: row.out_schema_ids },
  fields: resolveSelectFieldOptions(
    asSchemaFields(row.fields),
    enums
  ) as RelationSchemaVersion['fields'],
  groups: row.groups as RelationSchemaVersion['groups'],
  shared_field_group_links: (
    row as unknown as { shared_field_group_links?: SharedFieldGroupLink[] }
  ).shared_field_group_links,
  color: row.color,
  icon: row.icon,
  changeSummary: row.change_summary,
  createdBy: row.created_by,
  createdAt: row.created_at.toISOString()
});
