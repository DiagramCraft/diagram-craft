import { entityCapabilityTypeSchema, type EntityCapabilityType } from './entityCapabilityContract';
import type { EntityCapability } from './entityCapabilityContract';
import type { SchemaField } from './schemaContract';
import { z } from 'zod';

const entityCapabilityFieldTypeSchema = z.enum(['text', 'longtext', 'select']);

/** Integration-owned semantic field role metadata. */
export const entityCapabilityFieldRoleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  required: z.boolean(),
  defaultFieldId: z.string().min(1),
  allowedTypes: z.array(entityCapabilityFieldTypeSchema)
});

/** Integration-owned metadata for a capability available to entity schemas. */
export const entityCapabilityDefinitionSchema = z.object({
  type: entityCapabilityTypeSchema,
  label: z.string().min(1),
  description: z.string().min(1),
  features: z.array(z.string().min(1)),
  fieldRoles: z.array(entityCapabilityFieldRoleSchema)
});

export type EntityCapabilityDefinition = z.infer<typeof entityCapabilityDefinitionSchema>;
export type EntityCapabilityFieldRole = z.infer<typeof entityCapabilityFieldRoleSchema>;

export type EntityCapabilityFieldMappingIssue = {
  code:
    | 'unknown_role'
    | 'missing_target'
    | 'archived_target'
    | 'derived_target'
    | 'incompatible_target'
    | 'duplicate_target';
  roleId: string;
  fieldId?: string;
  message: string;
};

export type EntityCapabilityFieldMappingResolution = {
  mappings: Record<string, string>;
  issues: EntityCapabilityFieldMappingIssue[];
};

export const entityCapabilityDefinitions: EntityCapabilityDefinition[] = [
  {
    type: 'api-specification',
    label: 'API specification',
    description: 'OpenAPI and AsyncAPI documents with normalized operations or messages.',
    features: ['operations', 'documentation'],
    fieldRoles: [
      {
        id: 'api_type',
        label: 'API type',
        description: 'The declared API document protocol, such as OpenAPI or AsyncAPI.',
        required: true,
        defaultFieldId: 'api_type',
        allowedTypes: ['text', 'longtext', 'select']
      },
      {
        id: 'api_version',
        label: 'API version',
        description: 'The declared version of the API document.',
        required: true,
        defaultFieldId: 'api_version',
        allowedTypes: ['text', 'longtext', 'select']
      }
    ]
  }
];

export const getEntityCapabilityDefinition = (type: EntityCapabilityType | string) =>
  entityCapabilityDefinitions.find(capability => capability.type === type);

export const resolveEntityCapabilityFieldId = (
  capability: EntityCapability,
  role: EntityCapabilityFieldRole
) => capability.fieldMappings?.[role.id] ?? role.defaultFieldId;

export const remapEntityCapabilityFieldMappings = (
  capabilities: EntityCapability[],
  renames: ReadonlyArray<{ oldFieldId: string; newFieldId: string }>
): EntityCapability[] => {
  const renameByFieldId = new Map(renames.map(rename => [rename.oldFieldId, rename.newFieldId]));
  if (renameByFieldId.size === 0) return capabilities;

  return capabilities.map(capability => {
    const definition = getEntityCapabilityDefinition(capability.type);
    const nextMappings = { ...(capability.fieldMappings ?? {}) };
    let changed = false;

    for (const [roleId, fieldId] of Object.entries(nextMappings)) {
      const nextFieldId = renameByFieldId.get(fieldId);
      if (nextFieldId !== undefined) {
        nextMappings[roleId] = nextFieldId;
        changed = true;
      }
    }

    for (const role of definition?.fieldRoles ?? []) {
      const currentFieldId = resolveEntityCapabilityFieldId(capability, role);
      const nextFieldId = renameByFieldId.get(currentFieldId);
      if (nextFieldId !== undefined) {
        nextMappings[role.id] = nextFieldId;
        changed = true;
      }
    }

    return changed ? { ...capability, fieldMappings: nextMappings } : capability;
  });
};

export const resolveEntityCapabilityFieldMappings = (
  capability: EntityCapability,
  definition: EntityCapabilityDefinition,
  fields: ReadonlyArray<Pick<SchemaField, 'id' | 'type' | 'archived'>>
): EntityCapabilityFieldMappingResolution => {
  const rolesById = new Map(definition.fieldRoles.map(role => [role.id, role]));
  const mappings: Record<string, string> = {};
  const issues: EntityCapabilityFieldMappingIssue[] = [];
  const fieldById = new Map(fields.map(field => [field.id, field]));
  const targets = new Map<string, string>();

  for (const roleId of Object.keys(capability.fieldMappings ?? {})) {
    if (!rolesById.has(roleId)) {
      issues.push({
        code: 'unknown_role',
        roleId,
        fieldId: capability.fieldMappings?.[roleId],
        message: `Capability mapping refers to unknown role '${roleId}'.`
      });
    }
  }

  for (const role of definition.fieldRoles) {
    const explicitFieldId = capability.fieldMappings?.[role.id];
    const fieldId = resolveEntityCapabilityFieldId(capability, role);
    mappings[role.id] = fieldId;

    const previousRoleId = targets.get(fieldId);
    if (previousRoleId) {
      issues.push({
        code: 'duplicate_target',
        roleId: role.id,
        fieldId,
        message: `Roles '${previousRoleId}' and '${role.id}' both target field '${fieldId}'.`
      });
    } else {
      targets.set(fieldId, role.id);
    }

    const field = fieldById.get(fieldId);
    if (!field) {
      if (role.required || explicitFieldId !== undefined) {
        issues.push({
          code: 'missing_target',
          roleId: role.id,
          fieldId,
          message: `Role '${role.label}' targets missing field '${fieldId}'.`
        });
      }
      continue;
    }
    if (field.archived) {
      issues.push({
        code: 'archived_target',
        roleId: role.id,
        fieldId,
        message: `Role '${role.label}' cannot target archived field '${fieldId}'.`
      });
      continue;
    }
    if (field.type === 'derived') {
      issues.push({
        code: 'derived_target',
        roleId: role.id,
        fieldId,
        message: `Role '${role.label}' cannot target derived field '${fieldId}'.`
      });
      continue;
    }
    if (!(role.allowedTypes as readonly string[]).includes(field.type)) {
      issues.push({
        code: 'incompatible_target',
        roleId: role.id,
        fieldId,
        message: `Field '${fieldId}' has type '${field.type}', which is incompatible with role '${role.label}'.`
      });
    }
  }

  return { mappings, issues };
};
