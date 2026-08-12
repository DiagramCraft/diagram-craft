import { randomUUID } from 'node:crypto';
import type { WorkspaceEnumDbResult as InternalWorkspaceEnum } from './db/catalogDatabase';
import { SchemaDbResult as InternalEntitySchema } from './db/catalogDatabase';
import { httpAssert } from '../../utils/httpAssert';
import {
  EntitySchema,
  EntityTemplate,
  SchemaField,
  SchemaGroup,
  SchemaVersion,
  SharedFieldGroupLink,
  ValidationRule,
  isReferenceOrContainmentField,
  isTypedRelationField
} from '@arch-register/api-types/schemaContract';
import { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import type { EntityCapability } from '@arch-register/api-types/entityCapabilityContract';
import { normalizePublicIdPrefix, validatePublicIdPrefix } from '../../utils/publicIds';
import { buildDerivedPlan } from '../derived/derivedFields';
import { assertValidationRulesValid, normalizeValidationRules } from './entityValidationRules';
import {
  normalizeFieldMigrationFields,
  type FieldMigrationField
} from '../fieldMigration/fieldMigrationPlanning';
import type { SchemaGovernancePolicies } from '../governance/schemaGovernancePolicy';
type SchemaMutationPayload = {
  name: string;
  category: string | null;
  key_prefix: string;
  description: string;
  fields: InternalEntitySchema['fields'];
  templates: EntityTemplate[];
  groups: SchemaGroup[];
  shared_field_group_links: SharedFieldGroupLink[];
  entity_capabilities?: EntityCapability[];
  validation_rules: ValidationRule[];
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
  normalizePublicIdPrefix(name.replace(/[^a-z]/gi, '').slice(0, 5) ?? name.slice(0, 5));

export const normalizeSchemaCategory = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export const normalizeSchemaFields = (fields: unknown): InternalEntitySchema['fields'] => {
  if (!Array.isArray(fields)) return [];

  const normalized = fields.map(field => {
    httpAssert.json(field, { message: 'Schema fields must be objects' });

    if (field.type === 'containment') {
      httpAssert.true(field.maxCount === 1, {
        message: 'Containment fields must have maxCount set to 1'
      });
      httpAssert.true(field.minCount === 0 || field.minCount === 1, {
        message: 'Containment fields must have minCount set to 0 or 1'
      });

      if (field.requirementLevel === 'required') {
        field.minCount = 1;
      } else if (field.requirementLevel === 'optional' || field.requirementLevel === 'expected') {
        field.minCount = 0;
      }
    }

    if (field.type === 'number' && field.min !== undefined && field.max !== undefined) {
      httpAssert.true(field.min <= field.max, {
        message: 'Number field min must be less than or equal to max'
      });
    }

    return field as InternalEntitySchema['fields'][number];
  });
  buildDerivedPlan(normalized);
  return normalized;
};

const normalizeTemplateFieldValue = (
  value: unknown,
  field: InternalEntitySchema['fields'][number]
): EntityTemplate['values']['fields'][string] | undefined => {
  if (field.type === 'derived') return undefined;
  if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
    return undefined;
  }

  if (isReferenceOrContainmentField(field)) {
    httpAssert.true(Array.isArray(value) && value.every(item => typeof item === 'string'), {
      message: `Template value for "${field.name}" must be an array of entity ids`
    });
    const ids = [...new Set(value as string[])];
    httpAssert.true(field.maxCount === -1 || ids.length <= field.maxCount, {
      message: `Template value for "${field.name}" allows at most ${field.maxCount} relation(s)`
    });
    return ids;
  }

  if (isTypedRelationField(field)) {
    // No target entity ids here (unknowable ahead of instantiation) — just an array of
    // relation-instance field-value drafts to prefill once a target is chosen.
    httpAssert.true(
      Array.isArray(value) &&
        value.every(item => typeof item === 'object' && item !== null && !Array.isArray(item)),
      { message: `Template value for "${field.name}" must be an array of field-value objects` }
    );
    return value as EntityTemplate['values']['fields'][string];
  }

  if (field.type === 'boolean') {
    httpAssert.true(typeof value === 'boolean', {
      message: `Template value for "${field.name}" must be a boolean`
    });
    return value as boolean;
  }

  if (field.type === 'number') {
    httpAssert.true(typeof value === 'number' && Number.isInteger(value), {
      message: `Template value for "${field.name}" must be an integer`
    });
    const numberValue = value as number;
    httpAssert.true(field.min === undefined || numberValue >= field.min, {
      message: `Template value for "${field.name}" must be at least ${field.min}`
    });
    httpAssert.true(field.max === undefined || numberValue <= field.max, {
      message: `Template value for "${field.name}" must be at most ${field.max}`
    });
    return numberValue;
  }

  httpAssert.true(typeof value === 'string', {
    message: `Template value for "${field.name}" must be a string`
  });
  return value as string;
};

export const normalizeEntityTemplates = (
  templates: unknown,
  fields: InternalEntitySchema['fields']
): EntityTemplate[] => {
  if (templates === undefined) return [];
  httpAssert.true(Array.isArray(templates), { message: 'Schema templates must be an array' });
  const templateList = templates as unknown[];

  const fieldMap = new Map(fields.map(field => [field.id, field]));
  const ids = new Set<string>();
  const names = new Set<string>();

  return templateList.map(rawTemplate => {
    const template = rawTemplate as Record<string, unknown>;
    httpAssert.json(template, { message: 'Schema templates must be objects' });
    httpAssert.string(template.id, { message: 'Template id is required and must be a string' });
    httpAssert.string(template.name, { message: 'Template name is required and must be a string' });
    const id = template.id.trim();
    const name = template.name.trim();
    httpAssert.true(id.length > 0, { message: 'Template id cannot be empty' });
    httpAssert.true(name.length > 0, { message: 'Template name cannot be empty' });
    httpAssert.true(!ids.has(id), { message: `Duplicate template id '${id}'` });
    httpAssert.true(!names.has(name.toLowerCase()), {
      message: `Duplicate template name '${name}'`
    });
    ids.add(id);
    names.add(name.toLowerCase());

    httpAssert.json(template.values, { message: `Template '${name}' values must be an object` });
    const rawValues = template.values as Record<string, unknown>;
    const normalizedFields: EntityTemplate['values']['fields'] = {};
    if (rawValues.fields !== undefined) {
      httpAssert.json(rawValues.fields, { message: `Template '${name}' fields must be an object` });
      for (const [fieldId, value] of Object.entries(rawValues.fields)) {
        const field = fieldMap.get(fieldId);
        if (!field) continue;
        const normalized = normalizeTemplateFieldValue(value, field);
        if (normalized !== undefined) normalizedFields[fieldId] = normalized;
      }
    }

    const values: EntityTemplate['values'] = { fields: normalizedFields };
    for (const key of ['description', 'owner', 'lifecycle', 'namespace'] as const) {
      const value = rawValues[key];
      if (value === undefined || value === '') continue;
      httpAssert.true(typeof value === 'string', {
        message: `Template '${name}' ${key} must be a string`
      });
      values[key] = value as string;
    }
    if (rawValues.tags !== undefined) {
      httpAssert.true(
        Array.isArray(rawValues.tags) && rawValues.tags.every(tag => typeof tag === 'string'),
        { message: `Template '${name}' tags must be an array of strings` }
      );
      const tags = [
        ...new Set((rawValues.tags as string[]).map((tag: string) => tag.trim()).filter(Boolean))
      ];
      if (tags.length > 0) values.tags = tags;
    }

    return { id, name, values };
  });
};

const normalizeTeamIds = (teamIds: unknown): string[] | undefined => {
  if (!Array.isArray(teamIds)) return undefined;
  const filtered = [...new Set(teamIds.filter((id): id is string => typeof id === 'string'))];
  return filtered.length > 0 ? filtered : undefined;
};

const normalizeAccessControl = (
  accessControl: unknown
): SchemaGroup['accessControl'] | undefined => {
  if (accessControl === undefined || accessControl === null) return undefined;
  httpAssert.json(accessControl, { message: 'Group accessControl must be an object' });
  const teamIds = normalizeTeamIds((accessControl as Record<string, unknown>).teamIds);
  return teamIds ? { teamIds } : undefined;
};

export const normalizeSchemaGroups = (groups: unknown): SchemaGroup[] => {
  if (groups === undefined) return [];
  httpAssert.true(Array.isArray(groups), { message: 'Schema groups must be an array' });
  const groupList = groups as unknown[];

  const ids = new Set<string>();
  const names = new Set<string>();

  return groupList.map(rawGroup => {
    const group = rawGroup as Record<string, unknown>;
    httpAssert.json(group, { message: 'Schema groups must be objects' });
    httpAssert.string(group.id, { message: 'Group id is required and must be a string' });
    httpAssert.string(group.name, { message: 'Group name is required and must be a string' });
    const id = group.id.trim();
    const name = group.name.trim();
    httpAssert.true(id.length > 0, { message: 'Group id cannot be empty' });
    httpAssert.true(name.length > 0, { message: 'Group name cannot be empty' });
    httpAssert.true(!ids.has(id), { message: `Duplicate group id '${id}'` });
    httpAssert.true(!names.has(name.toLowerCase()), { message: `Duplicate group name '${name}'` });
    ids.add(id);
    names.add(name.toLowerCase());

    const description =
      typeof group.description === 'string' && group.description.trim() !== ''
        ? group.description.trim()
        : undefined;
    const accessControl = normalizeAccessControl(group.accessControl);

    return {
      id,
      name,
      ...(description ? { description } : {}),
      ...(accessControl ? { accessControl } : {})
    };
  });
};

export const normalizeSharedFieldGroupLinks = (links: unknown): SharedFieldGroupLink[] => {
  if (!Array.isArray(links)) return [];
  const seen = new Set<string>();
  const result: SharedFieldGroupLink[] = [];
  for (const rawLink of links) {
    const groupId =
      typeof rawLink === 'string'
        ? rawLink
        : typeof (rawLink as Record<string, unknown>)?.groupId === 'string'
          ? ((rawLink as Record<string, unknown>).groupId as string)
          : undefined;
    if (!groupId || seen.has(groupId)) continue;
    seen.add(groupId);
    const teamIds =
      typeof rawLink === 'object' && rawLink !== null
        ? normalizeTeamIds((rawLink as Record<string, unknown>).teamIds)
        : undefined;
    result.push({ groupId, ...(teamIds ? { teamIds } : {}) });
  }
  return result;
};

export const clearOrphanedGroupIds = <F extends { groupId?: string }>(
  fields: F[],
  groups: SchemaGroup[]
): F[] => {
  const groupIds = new Set(groups.map(group => group.id));
  return fields.map(field =>
    field.groupId && !groupIds.has(field.groupId) ? { ...field, groupId: undefined } : field
  );
};

export const findUnresolvedFieldGroupReferences = (
  fields: Array<{ id: string; name?: string; groupId?: string }>,
  groups: Array<{ id: string }>
) => {
  const groupIds = new Set(groups.map(group => group.id));
  return fields.flatMap(field =>
    field.groupId != null && !groupIds.has(field.groupId)
      ? [{ fieldId: field.id, fieldName: field.name ?? field.id, groupId: field.groupId }]
      : []
  );
};

export const assertResolvedFieldGroupReferences = (
  fields: Array<{ id: string; name?: string; groupId?: string }>,
  groups: Array<{ id: string }>
) => {
  const unresolved = findUnresolvedFieldGroupReferences(fields, groups);
  httpAssert.true(unresolved.length === 0, {
    status: 400,
    message: unresolved
      .map(
        reference =>
          `Field '${reference.fieldName}' references missing field group '${reference.groupId}'`
      )
      .join('; ')
  });
};

export const buildCreateSchemaInput = (
  workspace: string,
  body: Record<string, unknown>,
  teamIds: Set<string>,
  timestamp: Date,
  idFactory: () => string = randomUUID
) => {
  const {
    name,
    category,
    key_prefix,
    description = '',
    fields = [],
    templates = [],
    groups = [],
    shared_field_group_links = [],
    entity_capabilities,
    validation_rules,
    color,
    icon,
    default_owner
  } = body;
  httpAssert.string(name, { message: 'name is required and must be a string' });
  const normalizedGroups = normalizeSchemaGroups(groups);
  const normalizedFields = normalizeSchemaFields(fields);
  const normalizedValidationRules = normalizeValidationRules(validation_rules, normalizedFields);
  assertValidationRulesValid(normalizedValidationRules);
  assertResolvedFieldGroupReferences(normalizedFields, normalizedGroups);

  return {
    id: idFactory(),
    workspace,
    name,
    category: normalizeSchemaCategory(category),
    key_prefix:
      key_prefix !== undefined
        ? validatePublicIdPrefix(key_prefix, 'key_prefix')!
        : validatePublicIdPrefix(defaultKeyPrefixFromName(name), 'key_prefix')!,
    description: typeof description === 'string' ? description : '',
    fields: normalizedFields,
    templates: normalizeEntityTemplates(templates, normalizedFields),
    groups: normalizedGroups,
    shared_field_group_links: normalizeSharedFieldGroupLinks(shared_field_group_links),
    ...(Array.isArray(entity_capabilities) && { entity_capabilities }),
    validation_rules: normalizedValidationRules,
    color: typeof color === 'string' ? color : null,
    icon: typeof icon === 'string' ? icon : null,
    default_owner: resolveSchemaDefaultOwner(default_owner, teamIds, null),
    created_at: timestamp,
    updated_at: timestamp
  };
};

export const buildUpdateSchemaInput = (
  body: Record<string, unknown>,
  current: InternalEntitySchema & Partial<SchemaGovernancePolicies>,
  teamIds: Set<string>,
  timestamp: Date
): SchemaMutationPayload & { updated_at: Date } => {
  const {
    name,
    category,
    key_prefix,
    description,
    fields,
    templates,
    groups,
    shared_field_group_links,
    entity_capabilities,
    validation_rules,
    color,
    icon,
    default_owner
  } = body;
  httpAssert.string(name, { message: 'name is required and must be a string' });
  const normalizedGroups =
    groups !== undefined ? normalizeSchemaGroups(groups) : (current.groups ?? []);
  const rawFields = fields !== undefined ? normalizeSchemaFields(fields) : current.fields;
  const normalizedFields = rawFields;
  const normalizedValidationRules =
    validation_rules !== undefined
      ? normalizeValidationRules(validation_rules, normalizedFields)
      : (current.validation_rules ?? []);
  assertValidationRulesValid(normalizedValidationRules);
  assertResolvedFieldGroupReferences(normalizedFields, normalizedGroups);

  return {
    name,
    category:
      category !== undefined ? normalizeSchemaCategory(category) : (current.category ?? null),
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
    fields: normalizedFields,
    templates: normalizeEntityTemplates(templates ?? current.templates ?? [], normalizedFields),
    groups: normalizedGroups,
    shared_field_group_links:
      groups !== undefined
        ? normalizeSharedFieldGroupLinks(shared_field_group_links)
        : (current.shared_field_group_links ?? []),
    ...(entity_capabilities !== undefined
      ? { entity_capabilities: Array.isArray(entity_capabilities) ? entity_capabilities : [] }
      : current.entity_capabilities !== undefined
        ? { entity_capabilities: current.entity_capabilities }
        : {}),
    validation_rules: normalizedValidationRules,
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

export const toFieldMigrationFields = (fields: readonly SchemaField[]): FieldMigrationField[] =>
  normalizeFieldMigrationFields(fields, {
    getId: field => field.id,
    getName: field => field.name,
    getType: field => field.type,
    isRequired: field => field.requirementLevel === 'required',
    isArchived: field => field.archived === true
  });

export const toApiEnum = (e: InternalWorkspaceEnum): WorkspaceEnum => ({
  id: e.id,
  workspace: e.workspace,
  name: e.name,
  options: e.options,
  sort_order: e.sort_order,
  created_at: e.created_at.toISOString(),
  updated_at: e.updated_at.toISOString()
});

type SelectOptionField = {
  type: string;
  enumId?: string;
  resultType?: string;
};

type ResolvedField<TField> = TField extends { type: 'select' }
  ? TField & { options: InternalWorkspaceEnum['options'] }
  : TField extends { type: 'derived'; resultType: 'select' }
    ? TField & { options?: InternalWorkspaceEnum['options'] }
    : TField;

export const resolveSelectFieldOptions = <TField extends SelectOptionField>(
  fields: TField[],
  enums: InternalWorkspaceEnum[]
): ResolvedField<TField>[] => {
  const enumMap = new Map(enums.map(e => [e.id, e]));
  return fields.map(field => {
    if (field.type === 'select') {
      const enumDef = field.enumId ? enumMap.get(field.enumId) : undefined;
      return {
        ...field,
        options: enumDef?.options ?? []
      } as ResolvedField<TField>;
    }
    if (field.type === 'derived' && field.resultType === 'select') {
      const enumDef = field.enumId ? enumMap.get(field.enumId) : undefined;
      return {
        ...field,
        options: enumDef?.options ?? []
      } as ResolvedField<TField>;
    }
    return field as ResolvedField<TField>;
  });
};

export const toApiSharedFieldGroup = (
  group: {
    id: string;
    workspace: string;
    name: string;
    description: string | null;
    fields: SchemaField[];
    sort_order: number;
    created_at: Date;
    updated_at: Date;
  },
  enums: InternalWorkspaceEnum[]
) => ({
  id: group.id,
  workspace: group.workspace,
  name: group.name,
  ...(group.description ? { description: group.description } : {}),
  fields: resolveSelectFieldOptions(group.fields, enums),
  sort_order: group.sort_order,
  created_at: group.created_at.toISOString(),
  updated_at: group.updated_at.toISOString()
});

export const toApiSchema = (
  schema: InternalEntitySchema,
  entityCount: number,
  enums: InternalWorkspaceEnum[],
  policies: SchemaGovernancePolicies = {
    entity_approval_policy: 'disabled',
    deprecation_policy: 'disabled'
  }
): EntitySchema => {
  const fields = resolveSelectFieldOptions(schema.fields, enums);
  return {
    id: schema.id,
    workspace: schema.workspace,
    name: schema.name,
    category: schema.category ?? null,
    description: schema.description,
    key_prefix: schema.key_prefix,
    fields,
    templates: schema.templates ?? [],
    groups: schema.groups ?? [],
    shared_field_group_links: schema.shared_field_group_links ?? [],
    entity_capabilities: schema.entity_capabilities ?? [],
    validation_rules: schema.validation_rules ?? [],
    color: schema.color,
    icon: schema.icon,
    entity_count: entityCount,
    version: schema.version ?? 1,
    entity_approval_policy: policies.entity_approval_policy,
    deprecation_policy: policies.deprecation_policy,
    created_at: schema.created_at.toISOString(),
    updated_at: schema.updated_at.toISOString()
  };
};

export const toApiSchemaVersion = (
  row: {
    version: number;
    name: string;
    category?: string | null;
    description: string;
    fields: SchemaField[];
    templates: EntityTemplate[];
    groups: SchemaGroup[];
    shared_field_group_links?: SharedFieldGroupLink[];
    entity_capabilities?: EntityCapability[];
    validation_rules?: ValidationRule[];
    color: string | null;
    icon: string | null;
    change_summary: Record<string, unknown>;
    created_by: string | null;
    created_at: Date;
  },
  enums: InternalWorkspaceEnum[]
): SchemaVersion => ({
  version: row.version,
  name: row.name,
  category: row.category ?? null,
  description: row.description,
  fields: resolveSelectFieldOptions(row.fields, enums),
  templates: row.templates,
  groups: row.groups,
  shared_field_group_links: row.shared_field_group_links ?? [],
  entity_capabilities: row.entity_capabilities ?? [],
  validation_rules: row.validation_rules ?? [],
  color: row.color,
  icon: row.icon,
  changeSummary: row.change_summary,
  createdBy: row.created_by,
  createdAt: row.created_at.toISOString()
});
