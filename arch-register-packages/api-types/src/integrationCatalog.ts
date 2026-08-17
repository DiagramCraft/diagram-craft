import {
  workspaceCapabilityTargetKindSchema,
  workspaceCapabilityTypeSchema,
  type WorkspaceCapabilityBinding,
  type WorkspaceCapabilityType
} from './workspaceCapabilityContract';
import { z } from 'zod';

const capabilityFieldTypeSchema = z.enum(['text', 'longtext', 'select', 'reference']);

/** Integration-owned semantic field role metadata. */
export const capabilityFieldRoleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  required: z.boolean(),
  defaultFieldId: z.string().min(1),
  allowedTypes: z.array(capabilityFieldTypeSchema),
  cardinality: z.enum(['single', 'multi']).optional(),
  referenceTargetBinding: z.string().min(1).optional()
});

export type CapabilityFieldRole = z.infer<typeof capabilityFieldRoleSchema>;

/** Integration-owned semantic role for a workspace capability binding. */
export const workspaceCapabilityBindingRoleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  required: z.boolean(),
  targetKind: workspaceCapabilityTargetKindSchema.describe(
    'Required workspace model object kind for this role'
  ),
  fieldRoles: z.array(capabilityFieldRoleSchema)
});

export const workspaceCapabilityDefinitionSchema = z.object({
  type: workspaceCapabilityTypeSchema,
  label: z.string().min(1),
  description: z.string().min(1),
  features: z.array(z.string().min(1)),
  bindingRoles: z.array(workspaceCapabilityBindingRoleSchema)
});

export type WorkspaceCapabilityBindingRole = z.infer<typeof workspaceCapabilityBindingRoleSchema>;
export type WorkspaceCapabilityDefinition = z.infer<typeof workspaceCapabilityDefinitionSchema>;

export type CapabilityFieldMappingIssue = {
  code:
    | 'unknown_role'
    | 'missing_target'
    | 'archived_target'
    | 'derived_target'
    | 'incompatible_target'
    | 'incompatible_cardinality'
    | 'invalid_reference_target'
    | 'duplicate_target';
  roleId: string;
  fieldId?: string;
  message: string;
};

export type CapabilityFieldMappingResolution = {
  mappings: Record<string, string>;
  issues: CapabilityFieldMappingIssue[];
};

export type CapabilityField = {
  id: string;
  type: string;
  archived?: boolean;
  minCardinality?: number;
  maxCardinality?: number;
  schemaId?: string;
  minCount?: number;
  maxCount?: number;
};

const apiSpecificationFieldRoles: CapabilityFieldRole[] = [
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
];

const businessGlossaryFieldRoles: CapabilityFieldRole[] = [
  {
    id: 'definition',
    label: 'Definition',
    description: 'The authoritative meaning of the business term.',
    required: true,
    defaultFieldId: 'definition',
    allowedTypes: ['longtext'],
    cardinality: 'single'
  },
  {
    id: 'synonyms',
    label: 'Synonyms',
    description: 'Alternative names for the term.',
    required: true,
    defaultFieldId: 'synonyms',
    allowedTypes: ['text'],
    cardinality: 'multi'
  },
  {
    id: 'abbreviations',
    label: 'Abbreviations',
    description: 'Short forms and abbreviations for the term.',
    required: true,
    defaultFieldId: 'abbreviations',
    allowedTypes: ['text'],
    cardinality: 'multi'
  },
  {
    id: 'categories',
    label: 'Categories',
    description: 'Zero or more flat glossary categories.',
    required: true,
    defaultFieldId: 'categories',
    allowedTypes: ['reference'],
    cardinality: 'multi',
    referenceTargetBinding: 'category'
  },
  {
    id: 'status',
    label: 'Status',
    description: 'Definition maturity, such as Draft, Proposed, or Approved.',
    required: true,
    defaultFieldId: 'status',
    allowedTypes: ['select'],
    cardinality: 'single'
  }
];

/** Integration-owned capabilities that can be configured at workspace scope. */
export const workspaceCapabilityDefinitions: WorkspaceCapabilityDefinition[] = [
  {
    type: 'api-specification',
    label: 'API specification',
    description: 'OpenAPI and AsyncAPI documents with normalized operations or messages.',
    features: ['operations', 'documentation'],
    bindingRoles: [
      {
        id: 'api',
        label: 'API entity schema',
        description: 'The entity schema used for API specification records.',
        required: true,
        targetKind: 'entity_schema',
        fieldRoles: apiSpecificationFieldRoles
      }
    ]
  },
  {
    type: 'business-glossary',
    label: 'Business glossary',
    description: 'Managed business terms, aliases, categories, usage, and quality reports.',
    features: ['alias-search', 'usage', 'quality-reports', 'governance'],
    bindingRoles: [
      {
        id: 'term',
        label: 'Term entity schema',
        description: 'The entity schema used for canonical business terms.',
        required: true,
        targetKind: 'entity_schema',
        fieldRoles: businessGlossaryFieldRoles
      },
      {
        id: 'category',
        label: 'Term category entity schema',
        description: 'The entity schema used for flat glossary categories.',
        required: true,
        targetKind: 'entity_schema',
        fieldRoles: []
      }
    ]
  }
];

export const getWorkspaceCapabilityDefinition = (type: WorkspaceCapabilityType | string) =>
  workspaceCapabilityDefinitions.find(capability => capability.type === type);

export const resolveCapabilityFieldId = (
  binding: WorkspaceCapabilityBinding,
  role: CapabilityFieldRole
) => binding.fieldMappings?.[role.id] ?? role.defaultFieldId;

export const remapCapabilityFieldMappings = (
  binding: WorkspaceCapabilityBinding,
  roles: ReadonlyArray<CapabilityFieldRole>,
  renames: ReadonlyArray<{ oldFieldId: string; newFieldId: string }>
): WorkspaceCapabilityBinding => {
  const renameByFieldId = new Map(renames.map(rename => [rename.oldFieldId, rename.newFieldId]));
  if (renameByFieldId.size === 0) return binding;

  const nextMappings = { ...(binding.fieldMappings ?? {}) };
  let changed = false;

  for (const [roleId, fieldId] of Object.entries(nextMappings)) {
    const nextFieldId = renameByFieldId.get(fieldId);
    if (nextFieldId !== undefined) {
      nextMappings[roleId] = nextFieldId;
      changed = true;
    }
  }

  for (const role of roles) {
    const currentFieldId = resolveCapabilityFieldId(binding, role);
    const nextFieldId = renameByFieldId.get(currentFieldId);
    if (nextFieldId !== undefined) {
      nextMappings[role.id] = nextFieldId;
      changed = true;
    }
  }

  return changed ? { ...binding, fieldMappings: nextMappings } : binding;
};

export const resolveCapabilityFieldMappings = (
  binding: WorkspaceCapabilityBinding,
  roles: ReadonlyArray<CapabilityFieldRole>,
  fields: ReadonlyArray<CapabilityField>
): CapabilityFieldMappingResolution => {
  const rolesById = new Map(roles.map(role => [role.id, role]));
  const mappings: Record<string, string> = {};
  const issues: CapabilityFieldMappingIssue[] = [];
  const fieldById = new Map(fields.map(field => [field.id, field]));
  const targets = new Map<string, string>();

  for (const roleId of Object.keys(binding.fieldMappings ?? {})) {
    if (!rolesById.has(roleId)) {
      issues.push({
        code: 'unknown_role',
        roleId,
        fieldId: binding.fieldMappings?.[roleId],
        message: `Capability mapping refers to unknown role '${roleId}'.`
      });
    }
  }

  for (const role of roles) {
    const explicitFieldId = binding.fieldMappings?.[role.id];
    const fieldId = resolveCapabilityFieldId(binding, role);
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
    if (field.archived === true) {
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
    if (role.cardinality === 'multi') {
      const maxCardinality = field.maxCardinality ?? 1;
      const maxCount = field.maxCount ?? 1;
      if (maxCardinality !== -1 && maxCardinality < 2 && maxCount !== -1 && maxCount < 2) {
        issues.push({
          code: 'incompatible_cardinality',
          roleId: role.id,
          fieldId,
          message: `Field '${fieldId}' must accept multiple values for role '${role.label}'.`
        });
      }
    }
    if (role.cardinality === 'single') {
      const maxCardinality = field.maxCardinality ?? 1;
      const maxCount = field.maxCount ?? 1;
      if (maxCardinality === -1 || maxCardinality > 1 || maxCount === -1 || maxCount > 1) {
        issues.push({
          code: 'incompatible_cardinality',
          roleId: role.id,
          fieldId,
          message: `Field '${fieldId}' must accept a single value for role '${role.label}'.`
        });
      }
    }
  }

  return { mappings, issues };
};
