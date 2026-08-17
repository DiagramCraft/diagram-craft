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
  normalizeSchemaCategory,
  normalizeSharedFieldGroupLinks,
  resolveSelectFieldOptions
} from './schemaHelpers';
import type { WorkspaceEnumDbResult as InternalWorkspaceEnum } from './db/catalogDatabase';
import {
  RelationField,
  RelationSchema,
  RelationSchemaVersion
} from '@arch-register/api-types/relationSchemaContract';
import type { SharedFieldGroupLink } from '@arch-register/api-types/schemaContract';
import { assertValidationRulesValid, normalizeValidationRules } from './entityValidationRules';
import {
  normalizeFieldMigrationFields,
  type FieldMigrationField
} from '../fieldMigration/fieldMigrationPlanning';

export const toFieldMigrationFields = (fields: readonly RelationField[]): FieldMigrationField[] =>
  normalizeFieldMigrationFields(fields, {
    getId: field => field.id,
    getName: field => field.name,
    getType: field => field.type,
    isRequired: field => field.requirementLevel === 'required',
    isArchived: field => field.archived === true
  });

const normalizeRelationEndpoint = (
  value: unknown,
  label: 'in' | 'out',
  knownEntitySchemaIds: Set<string>
): { schemaIds: string[] | 'any'; label?: string } => {
  httpAssert.json(value, { message: `"${label}" endpoint is required and must be an object` });
  const endpoint = value as Record<string, unknown>;
  const schemaIds = endpoint.schemaIds;
  const endpointLabel = endpoint.label;
  httpAssert.true(endpointLabel === undefined || typeof endpointLabel === 'string', {
    message: `"${label}.label" must be a string when provided`
  });
  if (schemaIds === 'any') {
    return {
      schemaIds: 'any',
      ...(typeof endpointLabel === 'string' && endpointLabel.trim()
        ? { label: endpointLabel.trim() }
        : {})
    };
  }
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
  return {
    schemaIds: ids,
    ...(typeof endpointLabel === 'string' && endpointLabel.trim()
      ? { label: endpointLabel.trim() }
      : {})
  };
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
    category,
    description = '',
    in: inEndpoint,
    out: outEndpoint,
    fields = [],
    groups = [],
    shared_field_group_links = [],
    validation_rules = [],
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
  const validationRules = normalizeValidationRules(validation_rules, normalizedFields);
  assertValidationRulesValid(validationRules, 'relation');
  const normalizedInEndpoint = normalizeRelationEndpoint(
    inEndpoint,
    'in',
    knownEntitySchemaIds
  );
  const normalizedOutEndpoint = normalizeRelationEndpoint(
    outEndpoint,
    'out',
    knownEntitySchemaIds
  );

  return {
    id: idFactory(),
    workspace,
    name,
    category: normalizeSchemaCategory(category),
    description: typeof description === 'string' ? description : '',
    in_schema_ids: normalizedInEndpoint.schemaIds,
    out_schema_ids: normalizedOutEndpoint.schemaIds,
    in_label: normalizedInEndpoint.label ?? null,
    out_label: normalizedOutEndpoint.label ?? null,
    fields: normalizedFields,
    groups: normalizedGroups,
    shared_field_group_links: normalizeSharedFieldGroupLinks(shared_field_group_links),
    validation_rules: validationRules,
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
    category,
    description,
    in: inEndpoint,
    out: outEndpoint,
    fields,
    groups,
    shared_field_group_links,
    validation_rules,
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
  const validationRules =
    validation_rules !== undefined
      ? normalizeValidationRules(validation_rules, normalizedFields)
      : (current.validation_rules ?? []);
  assertValidationRulesValid(validationRules, 'relation');

  return {
    name,
    category:
      category !== undefined ? normalizeSchemaCategory(category) : (current.category ?? null),
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
    in_label:
      inEndpoint !== undefined
        ? (normalizeRelationEndpoint(inEndpoint, 'in', knownEntitySchemaIds).label ?? null)
        : (current.in_label ?? null),
    out_label:
      outEndpoint !== undefined
        ? (normalizeRelationEndpoint(outEndpoint, 'out', knownEntitySchemaIds).label ?? null)
        : (current.out_label ?? null),
    fields: normalizedFields,
    groups: normalizedGroups,
    shared_field_group_links:
      groups !== undefined
        ? normalizeSharedFieldGroupLinks(shared_field_group_links)
        : (current.shared_field_group_links ?? []),
    validation_rules: validationRules,
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
  const fields = resolveSelectFieldOptions(schema.fields, enums) as RelationSchema['fields'];
  return {
    id: schema.id,
    workspace: schema.workspace,
    name: schema.name,
    category: schema.category ?? null,
    description: schema.description,
    in: {
      schemaIds: schema.in_schema_ids,
      ...(schema.in_label ? { label: schema.in_label } : {})
    },
    out: {
      schemaIds: schema.out_schema_ids,
      ...(schema.out_label ? { label: schema.out_label } : {})
    },
    fields,
    groups: (schema.groups ?? []) as RelationSchema['groups'],
    shared_field_group_links: schema.shared_field_group_links ?? [],
    validation_rules: schema.validation_rules ?? [],
    color: schema.color,
    icon: schema.icon,
    relation_count: relationCount,
    version: schema.version ?? 1,
    relation_approval_policy: schema.relation_approval_policy ?? 'disabled',
    created_at: schema.created_at.toISOString(),
    updated_at: schema.updated_at.toISOString()
  };
};

export const toApiRelationSchemaVersion = (
  row: RelationSchemaVersionDbResult,
  enums: InternalWorkspaceEnum[]
): RelationSchemaVersion => ({
  version: row.version,
  name: row.name,
  category: row.category ?? null,
  description: row.description,
  in: {
    schemaIds: row.in_schema_ids,
    ...(row.in_label ? { label: row.in_label } : {})
  },
  out: {
    schemaIds: row.out_schema_ids,
    ...(row.out_label ? { label: row.out_label } : {})
  },
  fields: resolveSelectFieldOptions(row.fields, enums) as RelationSchemaVersion['fields'],
  groups: row.groups as RelationSchemaVersion['groups'],
  validation_rules: row.validation_rules ?? [],
  shared_field_group_links: (
    row as unknown as { shared_field_group_links?: SharedFieldGroupLink[] }
  ).shared_field_group_links,
  color: row.color,
  icon: row.icon,
  changeSummary: row.change_summary,
  createdBy: row.created_by,
  createdAt: row.created_at.toISOString()
});
