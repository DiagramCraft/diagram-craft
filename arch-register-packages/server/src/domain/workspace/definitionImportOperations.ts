import { createHash, randomUUID } from 'node:crypto';
import type {
  DefinitionImportExecuteRequest,
  DefinitionImportExecuteResponse,
  DefinitionImportPreview,
  DefinitionImportRename,
  DefinitionImportSelection,
  DefinitionImportSource
} from '@arch-register/api-types/workspaceContract';
import type {
  SchemaField,
  SchemaGroup,
  SharedFieldGroupLink
} from '@arch-register/api-types/schemaContract';
import { isReferenceOrContainmentField } from '@arch-register/api-types/schemaContract';
import type { RelationField } from '@arch-register/api-types/relationSchemaContract';
import { isEntityRelationField } from '@arch-register/api-types/relationSchemaContract';
import type { DocumentAiAction, DocumentField } from '@arch-register/api-types/documentContract';
import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import type { WorkspaceCapabilityBindings } from '@arch-register/api-types/workspaceCapabilityContract';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { buildApiAuthCtx, requireWorkspaceAdmin } from '../auth/authorization';
import { PermissionChecker } from '@arch-register/permissions';
import { runAuthorizedOperation } from '../operation';
import { httpAssert } from '../../utils/httpAssert';
import { resolveWorkspace } from './resolveWorkspace';
import {
  SCHEMA_TEMPLATES,
  resolveTemplateDashboardWidgets,
  type SchemaTemplate,
  type SymbolicField
} from '../catalog/schemaTemplates';
import type {
  SchemaDbCreate,
  SharedFieldGroupDbCreate,
  WorkspaceEnumDbCreate
} from '../catalog/db/catalogDatabase';
import type {
  RelationSchemaDbCreate,
  RelationSchemaGroupDbShape
} from '../catalog/db/relationDatabase';
import {
  findUnresolvedFieldGroupReferences,
  assertResolvedFieldGroupReferences,
  toFieldMigrationFields as toSchemaFieldMigrationFields
} from '../catalog/schemaHelpers';
import { toFieldMigrationFields as toRelationFieldMigrationFields } from '../catalog/relationSchemaHelpers';
import { buildFieldChangeSummary } from '../fieldMigration/fieldMigrationPlanning';
import { validateDerivedFieldGroupAccess } from '../derived/derivedFields';
import { getSchemaGovernancePoliciesBySchema } from '../governance/schemaGovernancePolicy';
import { writeAudit } from '../audit/db/auditLogging';
import {
  appendWorkspaceDashboardLayout,
  replaceDefaultWorkspaceDashboardLayout
} from '../dashboard/dashboardOperations';

type ImportableSchema = {
  id: string;
  name: string;
  category: string | null;
  description: string;
  key_prefix: string;
  fields: SchemaField[];
  groups: SchemaGroup[];
  shared_field_group_links: SharedFieldGroupLink[];
  shared_field_groups: Array<{
    id: string;
    name: string;
    description: string | null;
    fields: SchemaField[];
    sort_order: number;
  }>;
  color: string | null;
  icon: string | null;
  default_owner_name: string | null;
  entity_approval_policy: 'required' | 'disabled';
  deprecation_policy: 'required' | 'disabled';
};

type ImportableEnum = {
  id: string;
  name: string;
  options: Array<{
    value: string;
    label: string;
    description?: string | null;
    retired?: boolean;
    restricted?: boolean;
  }>;
  sort_order: number;
};

type ImportableDocumentType = {
  id: string;
  name: string;
  description: string;
  fields: DocumentField[];
  aiActions: DocumentAiAction[];
  color: string | null;
  icon: string | null;
};

type ImportableRelationSchema = {
  id: string;
  name: string;
  category: string | null;
  description: string;
  in_schema_ids: string[] | 'any';
  out_schema_ids: string[] | 'any';
  in_label?: string | null;
  out_label?: string | null;
  fields: RelationField[];
  groups: RelationSchemaGroupDbShape[];
  shared_field_group_links: SharedFieldGroupLink[];
  shared_field_groups: Array<{
    id: string;
    name: string;
    description: string | null;
    fields: SchemaField[];
    sort_order: number;
  }>;
  color: string | null;
  icon: string | null;
  relation_approval_policy: 'required' | 'disabled';
};

type ImportableFieldGroup = {
  id: string;
  name: string;
  description: string | null;
  fields: SchemaField[];
  sort_order: number;
};

type ImportableCapabilityConfiguration = {
  id: string;
  type: string;
  bindings: WorkspaceCapabilityBindings;
};

type DefinitionSource = {
  kind: DefinitionImportSource['kind'];
  id: string;
  name: string;
  description: string;
  category: 'full' | 'cross-cutting' | null;
  schemas: ImportableSchema[];
  enums: ImportableEnum[];
  documentTypes: ImportableDocumentType[];
  relationSchemas: ImportableRelationSchema[];
  fieldGroups: ImportableFieldGroup[];
  capabilityConfigurations: ImportableCapabilityConfiguration[];
  dashboardWidgets: DashboardWidget[];
  teamNames: Record<string, string>;
};

type DefinitionImportPlan = {
  source: DefinitionImportSource;
  selection: DefinitionImportSelection;
  renames: DefinitionImportRename[];
  schemas: ImportableSchema[];
  enums: ImportableEnum[];
  documentTypes: ImportableDocumentType[];
  relationSchemas: ImportableRelationSchema[];
  fieldGroups: ImportableFieldGroup[];
  capabilityConfigurations: ImportableCapabilityConfiguration[];
  dashboardWidgets: DashboardWidget[];
  conflicts: Array<{
    kind: 'schema' | 'enum' | 'documentType' | 'relationSchema' | 'fieldGroup';
    id: string;
    name: string;
    existingName: string;
  }>;
  keyPrefixRemaps: Array<{ sourceId: string; name: string; from: string; to: string }>;
  errors: string[];
  fingerprint: string;
};

const checker = new PermissionChecker();

const lower = (value: string) => value.toLocaleLowerCase();
const renameKey = (kind: DefinitionImportRename['kind'], id: string) => `${kind}:${id}`;

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

const fingerprint = (value: unknown) =>
  createHash('sha256').update(stableStringify(value)).digest('hex');

const toCanonicalField = (field: SymbolicField): SchemaField => {
  if (field.type === 'reference') {
    return {
      id: field.id,
      name: field.name,
      predicate: field.predicate,
      type: 'reference',
      schemaId: field.symSchemaId,
      minCount: field.minCount,
      maxCount: field.maxCount
    };
  }
  if (field.type === 'containment') {
    return {
      id: field.id,
      name: field.name,
      predicate: field.predicate,
      type: 'containment',
      schemaId: field.symSchemaId,
      minCount: field.minCount,
      maxCount: field.maxCount
    };
  }
  if (field.type === 'typedRelation') {
    return {
      id: field.id,
      name: field.name,
      type: 'typedRelation',
      relationSchemaId: field.symRelationSchemaId,
      direction: field.direction,
      minCount: field.minCount,
      maxCount: field.maxCount
    };
  }
  return field as SchemaField;
};

const sourceFromBuiltin = (template: SchemaTemplate): DefinitionSource => ({
  kind: 'builtin',
  id: template.id,
  name: template.name,
  description: template.description,
  category: template.category,
  schemas: template.schemas.map(schema => ({
    id: schema.symId,
    name: schema.name,
    category: null,
    description: schema.description,
    key_prefix: schema.symId
      .replace(/[^a-z]/gi, '')
      .slice(0, 5)
      .toUpperCase(),
    fields: schema.fields.map(toCanonicalField),
    groups: [],
    shared_field_group_links: [],
    shared_field_groups: [],
    color: schema.color,
    icon: schema.icon,
    default_owner_name: null,
    entity_approval_policy: 'disabled',
    deprecation_policy: 'disabled'
  })),
  enums: template.enums.map((enumeration, index) => ({
    id: enumeration.id,
    name: enumeration.name,
    options: enumeration.options,
    sort_order: index
  })),
  documentTypes: template.documentTypes.map(documentType => ({
    id: documentType.id,
    name: documentType.name,
    description: documentType.description,
    fields: documentType.fields,
    aiActions: [],
    color: documentType.color,
    icon: documentType.icon
  })),
  relationSchemas: (template.relationSchemas ?? []).map(relationSchema => ({
    id: relationSchema.symId,
    name: relationSchema.name,
    category: null,
    description: relationSchema.description,
    in_schema_ids: relationSchema.inSymSchemaIds,
    out_schema_ids: relationSchema.outSymSchemaIds,
    in_label: relationSchema.inLabel,
    out_label: relationSchema.outLabel,
    fields: relationSchema.fields.map(
      field =>
        ({
          id: field.id,
          name: field.name,
          type: field.type,
          enumId: field.enumId,
          requirementLevel: field.requirementLevel
        }) as RelationField
    ),
    groups: [],
    shared_field_group_links: [],
    shared_field_groups: [],
    color: relationSchema.color,
    icon: relationSchema.icon,
    relation_approval_policy: 'disabled' as const
  })),
  fieldGroups: (template.fieldGroups ?? []).map((fieldGroup, index) => ({
    id: fieldGroup.id,
    name: fieldGroup.name,
    description: fieldGroup.description ?? null,
    fields: fieldGroup.fields.map(toCanonicalField),
    sort_order: index
  })),
  capabilityConfigurations: (template.capabilityConfigurations ?? []).map(
    (configuration, index) => ({
      id: `${template.id}:${configuration.type}:${index}`,
      type: configuration.type,
      bindings: Object.fromEntries(
        Object.entries(configuration.bindings).map(([bindingId, binding]) => [
          bindingId,
          {
            ...binding,
            target: { kind: binding.target.kind, id: binding.target.symId }
          }
        ])
      ) as WorkspaceCapabilityBindings
    })
  ),
  dashboardWidgets: template.dashboardWidgets ?? [],
  teamNames: {}
});

const sourceFromWorkspace = async (
  db: DatabaseAdapter,
  workspace: string
): Promise<DefinitionSource> => {
  const workspaceRow = await db.workspace.getWorkspace(workspace);
  httpAssert.present(workspaceRow, { status: 404, message: `Workspace '${workspace}' not found` });
  const [
    schemas,
    enums,
    documentTypes,
    teams,
    sharedFieldGroups,
    policiesBySchema,
    relationSchemas,
    capabilityConfigurations
  ] = await Promise.all([
    db.catalog.listSchemas(workspace),
    db.catalog.listEnums(workspace),
    db.document.listDocumentTypes(workspace, true),
    db.workspace.listTeams(workspace),
    db.catalog.listSharedFieldGroups(workspace),
    getSchemaGovernancePoliciesBySchema(db, workspace),
    db.relation.listRelationSchemas(workspace),
    db.workspace.listWorkspaceCapabilityConfigurations(workspace)
  ]);
  const teamNames = new Map(teams.map(team => [team.id, team.name]));

  return {
    kind: 'workspace',
    id: workspaceRow.id,
    name: workspaceRow.name,
    description: workspaceRow.description,
    schemas: schemas.map(schema => ({
      id: schema.id,
      name: schema.name,
      category: schema.category ?? null,
      description: schema.description,
      key_prefix: schema.key_prefix,
      fields: schema.fields,
      groups: schema.groups ?? [],
      shared_field_group_links: schema.shared_field_group_links ?? [],
      shared_field_groups: (schema.shared_field_group_links ?? []).flatMap(link => {
        const group = sharedFieldGroups.find(item => item.id === link.groupId);
        return group ? [{ ...group, fields: group.fields }] : [];
      }),
      color: schema.color,
      icon: schema.icon,
      default_owner_name: schema.default_owner
        ? (teamNames.get(schema.default_owner) ?? null)
        : null,
      entity_approval_policy: policiesBySchema.get(schema.id)?.entity_approval_policy ?? 'disabled',
      deprecation_policy: policiesBySchema.get(schema.id)?.deprecation_policy ?? 'disabled'
    })),
    enums: enums.map(enumeration => ({
      id: enumeration.id,
      name: enumeration.name,
      options: enumeration.options,
      sort_order: enumeration.sort_order
    })),
    documentTypes: documentTypes
      .filter(documentType => !documentType.archived)
      .map(documentType => ({
        id: documentType.id,
        name: documentType.name,
        description: documentType.description,
        fields: documentType.fields,
        aiActions: documentType.aiActions ?? [],
        color: documentType.color,
        icon: documentType.icon
      })),
    relationSchemas: relationSchemas.map(schema => ({
      id: schema.id,
      name: schema.name,
      category: schema.category ?? null,
      description: schema.description,
      in_schema_ids: schema.in_schema_ids,
      out_schema_ids: schema.out_schema_ids,
      in_label: schema.in_label ?? null,
      out_label: schema.out_label ?? null,
      fields: schema.fields,
      groups: schema.groups ?? [],
      shared_field_group_links: schema.shared_field_group_links ?? [],
      shared_field_groups: (schema.shared_field_group_links ?? []).flatMap(link => {
        const group = sharedFieldGroups.find(item => item.id === link.groupId);
        return group ? [{ ...group, fields: group.fields }] : [];
      }),
      color: schema.color,
      icon: schema.icon,
      relation_approval_policy: schema.relation_approval_policy ?? 'disabled'
    })),
    fieldGroups: sharedFieldGroups.map(group => ({
      id: group.id,
      name: group.name,
      description: group.description,
      fields: group.fields,
      sort_order: group.sort_order
    })),
    capabilityConfigurations: capabilityConfigurations.map(configuration => ({
      id: configuration.id,
      type: configuration.type,
      bindings: configuration.bindings
    })),
    dashboardWidgets: [],
    category: null,
    teamNames: Object.fromEntries(teamNames)
  };
};

const getSource = async (
  db: DatabaseAdapter,
  targetWorkspace: string,
  source: DefinitionImportSource,
  event: AuthenticatedEvent
): Promise<DefinitionSource> => {
  if (source.kind === 'builtin') {
    const template = SCHEMA_TEMPLATES.find(item => item.id === source.id);
    httpAssert.present(template, { status: 404, message: `Template '${source.id}' not found` });
    return sourceFromBuiltin(template);
  }

  const sourceWorkspace = await resolveWorkspace(db.catalog, source.id);
  httpAssert.true(sourceWorkspace !== targetWorkspace, {
    status: 400,
    message: 'The source workspace must be different from the destination workspace'
  });
  // Definition import authorizes the distinct source workspace independently of the destination
  // context used by the route operation.
  const sourceAuthCtx = await buildApiAuthCtx(db, sourceWorkspace, event);
  requireWorkspaceAdmin(sourceAuthCtx, 'You must administer the source workspace');
  return sourceFromWorkspace(db, sourceWorkspace);
};

const buildPlan = async (
  db: DatabaseAdapter,
  targetWorkspace: string,
  source: DefinitionImportSource,
  selection: DefinitionImportSelection,
  renames: DefinitionImportRename[],
  event: AuthenticatedEvent
): Promise<DefinitionImportPlan> => {
  const sourceData = await getSource(db, targetWorkspace, source, event);
  const errors: string[] = [];
  const renameByKey = new Map<string, string>();
  for (const rename of renames) {
    const key = renameKey(rename.kind, rename.id);
    if (renameByKey.has(key)) {
      errors.push(`Multiple rename requests were provided for '${rename.id}'`);
    } else {
      renameByKey.set(key, rename.name.trim());
    }
  }
  const selectedSchemaIds = new Set(selection.schemas);
  const selectedEnumIds = new Set(selection.enums);
  const selectedDocumentTypeIds = new Set(selection.documentTypes);
  const selectedRelationSchemaIds = new Set(selection.relationSchemas);
  const selectedFieldGroupIds = new Set(selection.fieldGroups);
  if (
    selectedSchemaIds.size +
      selectedEnumIds.size +
      selectedDocumentTypeIds.size +
      selectedRelationSchemaIds.size +
      selectedFieldGroupIds.size ===
    0
  ) {
    errors.push(
      'Select at least one schema, enum, active document type, relation schema, or field group'
    );
  }

  const schemaById = new Map(
    sourceData.schemas.map(schema => [
      schema.id,
      { ...schema, name: renameByKey.get(renameKey('schema', schema.id)) ?? schema.name }
    ])
  );
  const enumById = new Map(
    sourceData.enums.map(enumeration => [
      enumeration.id,
      {
        ...enumeration,
        name: renameByKey.get(renameKey('enum', enumeration.id)) ?? enumeration.name
      }
    ])
  );
  const documentTypeById = new Map(
    sourceData.documentTypes.map(type => [
      type.id,
      { ...type, name: renameByKey.get(renameKey('documentType', type.id)) ?? type.name }
    ])
  );
  const relationSchemaById = new Map(
    sourceData.relationSchemas.map(schema => [
      schema.id,
      { ...schema, name: renameByKey.get(renameKey('relationSchema', schema.id)) ?? schema.name }
    ])
  );
  const fieldGroupById = new Map(
    sourceData.fieldGroups.map(group => [
      group.id,
      { ...group, name: renameByKey.get(renameKey('fieldGroup', group.id)) ?? group.name }
    ])
  );
  for (const rename of renames) {
    const known =
      (rename.kind === 'schema' && schemaById.has(rename.id)) ||
      (rename.kind === 'enum' && enumById.has(rename.id)) ||
      (rename.kind === 'documentType' && documentTypeById.has(rename.id)) ||
      (rename.kind === 'relationSchema' && relationSchemaById.has(rename.id)) ||
      (rename.kind === 'fieldGroup' && fieldGroupById.has(rename.id));
    if (!known) errors.push(`Cannot rename unknown ${rename.kind} '${rename.id}'`);
  }
  const resolvedSchemaIds = new Set<string>();
  const resolvedRelationSchemaIds = new Set<string>();
  const resolvedEnumIds = new Set(selectedEnumIds);
  const schemaQueue = [...selectedSchemaIds];
  const relationSchemaQueue = [...selectedRelationSchemaIds];

  do {
    while (schemaQueue.length > 0) {
      const schemaId = schemaQueue.shift()!;
      if (resolvedSchemaIds.has(schemaId)) continue;
      const schema = schemaById.get(schemaId);
      if (!schema) {
        errors.push(`Schema '${schemaId}' was not found in the source`);
        continue;
      }
      resolvedSchemaIds.add(schemaId);
      for (const field of schema.fields) {
        if (isReferenceOrContainmentField(field)) {
          if (!schemaById.has(field.schemaId)) {
            errors.push(`Schema '${schema.name}' references missing schema '${field.schemaId}'`);
          } else {
            schemaQueue.push(field.schemaId);
          }
        } else if (field.type === 'typedRelation') {
          if (!relationSchemaById.has(field.relationSchemaId)) {
            errors.push(
              `Schema '${schema.name}' references missing relation schema '${field.relationSchemaId}'`
            );
          } else {
            relationSchemaQueue.push(field.relationSchemaId);
          }
        } else if (field.type === 'select') {
          if (!enumById.has(field.enumId)) {
            errors.push(`Schema '${schema.name}' references missing enum '${field.enumId}'`);
          } else {
            resolvedEnumIds.add(field.enumId);
          }
        }
      }
    }

    while (relationSchemaQueue.length > 0) {
      const relationSchemaId = relationSchemaQueue.shift()!;
      if (resolvedRelationSchemaIds.has(relationSchemaId)) continue;
      const relationSchema = relationSchemaById.get(relationSchemaId);
      if (!relationSchema) {
        errors.push(`Relation schema '${relationSchemaId}' was not found in the source`);
        continue;
      }
      resolvedRelationSchemaIds.add(relationSchemaId);
      for (const schemaId of [
        ...(relationSchema.in_schema_ids === 'any' ? [] : relationSchema.in_schema_ids),
        ...(relationSchema.out_schema_ids === 'any' ? [] : relationSchema.out_schema_ids)
      ]) {
        if (!schemaById.has(schemaId)) {
          errors.push(
            `Relation schema '${relationSchema.name}' references missing schema '${schemaId}'`
          );
        } else {
          schemaQueue.push(schemaId);
        }
      }
      for (const field of relationSchema.fields) {
        if (isEntityRelationField(field)) {
          if (!schemaById.has(field.schemaId)) {
            errors.push(
              `Relation schema '${relationSchema.name}' references missing schema '${field.schemaId}'`
            );
          } else {
            schemaQueue.push(field.schemaId);
          }
        } else if (field.type === 'select') {
          if (!enumById.has(field.enumId)) {
            errors.push(
              `Relation schema '${relationSchema.name}' references missing enum '${field.enumId}'`
            );
          } else {
            resolvedEnumIds.add(field.enumId);
          }
        }
      }
    }
  } while (schemaQueue.length > 0 || relationSchemaQueue.length > 0);

  for (const enumId of resolvedEnumIds) {
    if (!enumById.has(enumId)) errors.push(`Enum '${enumId}' was not found in the source`);
  }
  for (const documentTypeId of selectedDocumentTypeIds) {
    if (!documentTypeById.has(documentTypeId))
      errors.push(`Active document type '${documentTypeId}' was not found in the source`);
  }
  for (const fieldGroupId of selectedFieldGroupIds) {
    if (!fieldGroupById.has(fieldGroupId))
      errors.push(`Field group '${fieldGroupId}' was not found in the source`);
  }

  const schemas = [...schemaById.values()].filter(schema => resolvedSchemaIds.has(schema.id));
  const enums = [...enumById.values()].filter(enumeration => resolvedEnumIds.has(enumeration.id));
  const documentTypes = [...documentTypeById.values()].filter(type =>
    selectedDocumentTypeIds.has(type.id)
  );
  const relationSchemas = [...relationSchemaById.values()].filter(schema =>
    resolvedRelationSchemaIds.has(schema.id)
  );
  const fieldGroups = [...fieldGroupById.values()].filter(group =>
    selectedFieldGroupIds.has(group.id)
  );
  const capabilityConfigurations = sourceData.capabilityConfigurations.filter(configuration =>
    Object.values(configuration.bindings).every(binding => {
      switch (binding.target.kind) {
        case 'entity_schema':
          return resolvedSchemaIds.has(binding.target.id);
        case 'relation_schema':
          return resolvedRelationSchemaIds.has(binding.target.id);
        case 'document_type':
          return selectedDocumentTypeIds.has(binding.target.id);
      }
    })
  );

  for (const schema of schemas) {
    const unresolved = findUnresolvedFieldGroupReferences(schema.fields, schema.groups);
    if (unresolved.length > 0) {
      errors.push(
        ...unresolved.map(
          reference =>
            `Schema '${schema.name}' field '${reference.fieldName}' references missing field group '${reference.groupId}'`
        )
      );
      continue;
    }
    try {
      validateDerivedFieldGroupAccess(schema.fields, schema.groups);
    } catch (error) {
      errors.push(
        error instanceof Error ? `Schema '${schema.name}': ${error.message}` : String(error)
      );
    }
  }

  // Relation fields have no 'derived' type by design (relationSchemaContract.ts), so
  // validateDerivedFieldGroupAccess is structurally inapplicable here and intentionally skipped.
  for (const relationSchema of relationSchemas) {
    const unresolved = findUnresolvedFieldGroupReferences(
      relationSchema.fields,
      relationSchema.groups
    );
    if (unresolved.length > 0) {
      errors.push(
        ...unresolved.map(
          reference =>
            `Relation schema '${relationSchema.name}' field '${reference.fieldName}' references missing field group '${reference.groupId}'`
        )
      );
    }
  }

  const [
    existingSchemas,
    existingEnums,
    existingDocumentTypes,
    existingRelationSchemas,
    existingFieldGroups
  ] = await Promise.all([
    db.catalog.listSchemas(targetWorkspace),
    db.catalog.listEnums(targetWorkspace),
    db.document.listDocumentTypes(targetWorkspace, true),
    db.relation.listRelationSchemas(targetWorkspace),
    db.catalog.listSharedFieldGroups(targetWorkspace)
  ]);
  const conflicts: DefinitionImportPlan['conflicts'] = [];
  const checkNames = (
    kind: DefinitionImportPlan['conflicts'][number]['kind'],
    items: Array<{ id: string; name: string }>,
    existing: Array<{ name: string }>
  ) => {
    const existingNames = new Map(existing.map(item => [lower(item.name), item.name]));
    const seen = new Set<string>();
    for (const item of items) {
      const key = lower(item.name);
      if (seen.has(key))
        conflicts.push({ kind, id: item.id, name: item.name, existingName: item.name });
      const existingName = existingNames.get(key);
      if (existingName) conflicts.push({ kind, id: item.id, name: item.name, existingName });
      seen.add(key);
    }
  };
  checkNames('schema', schemas, existingSchemas);
  checkNames('enum', enums, existingEnums);
  checkNames('documentType', documentTypes, existingDocumentTypes);
  checkNames('relationSchema', relationSchemas, existingRelationSchemas);
  checkNames('fieldGroup', fieldGroups, existingFieldGroups);

  const usedPrefixes = new Set(existingSchemas.map(schema => lower(schema.key_prefix)));
  const keyPrefixRemaps: DefinitionImportPlan['keyPrefixRemaps'] = [];
  const resolvedSchemas = [] as ImportableSchema[];
  for (const schema of schemas) {
    const original = schema.key_prefix;
    let next = original;
    const isPrefixUsed = async (prefix: string) =>
      usedPrefixes.has(lower(prefix)) || (await db.catalog.getSchemaByKeyPrefix(prefix)) !== null;
    if (await isPrefixUsed(next)) {
      let attempt = 0;
      do {
        next = createHash('sha1')
          .update(`${source.kind}:${source.id}:${schema.id}:${attempt++}`)
          .digest('hex')
          .slice(0, 5)
          .toUpperCase();
      } while (await isPrefixUsed(next));
      keyPrefixRemaps.push({ sourceId: schema.id, name: schema.name, from: original, to: next });
    }
    usedPrefixes.add(lower(next));
    resolvedSchemas.push({ ...schema, key_prefix: next });
  }

  const fingerprintPayload = {
    source,
    selection,
    renames,
    schemas: resolvedSchemas.map(schema => ({
      id: schema.id,
      name: schema.name,
      dependency: !selectedSchemaIds.has(schema.id),
      definition: schema
    })),
    enums: enums.map(enumeration => ({
      id: enumeration.id,
      name: enumeration.name,
      dependency: !selectedEnumIds.has(enumeration.id),
      definition: enumeration
    })),
    documentTypes: documentTypes.map(documentType => ({
      id: documentType.id,
      name: documentType.name,
      dependency: false,
      definition: documentType
    })),
    relationSchemas: relationSchemas.map(schema => ({
      id: schema.id,
      name: schema.name,
      dependency: !selectedRelationSchemaIds.has(schema.id),
      definition: schema
    })),
    fieldGroups: fieldGroups.map(group => ({
      id: group.id,
      name: group.name,
      dependency: false,
      definition: group
    })),
    capabilityConfigurations,
    dashboardWidgets: selection.dashboard ? sourceData.dashboardWidgets : [],
    keyPrefixRemaps,
    errors,
    conflicts
  };
  return {
    source,
    selection,
    renames,
    schemas: resolvedSchemas,
    enums,
    documentTypes,
    relationSchemas,
    fieldGroups,
    capabilityConfigurations,
    dashboardWidgets: selection.dashboard ? sourceData.dashboardWidgets : [],
    conflicts,
    keyPrefixRemaps,
    errors,
    fingerprint: fingerprint(fingerprintPayload)
  };
};

const toPreview = (plan: DefinitionImportPlan): DefinitionImportPreview => ({
  source: plan.source,
  selection: plan.selection,
  renames: plan.renames,
  schemas: plan.schemas.map(schema => ({
    id: schema.id,
    name: schema.name,
    dependency: !plan.selection.schemas.includes(schema.id),
    definition: schema
  })),
  enums: plan.enums.map(enumeration => ({
    id: enumeration.id,
    name: enumeration.name,
    dependency: !plan.selection.enums.includes(enumeration.id),
    definition: enumeration
  })),
  documentTypes: plan.documentTypes.map(documentType => ({
    id: documentType.id,
    name: documentType.name,
    dependency: false,
    definition: documentType
  })),
  relationSchemas: plan.relationSchemas.map(schema => ({
    id: schema.id,
    name: schema.name,
    dependency: !plan.selection.relationSchemas.includes(schema.id),
    definition: schema
  })),
  fieldGroups: plan.fieldGroups.map(group => ({
    id: group.id,
    name: group.name,
    dependency: false,
    definition: group
  })),
  dashboardWidgets: plan.dashboardWidgets,
  conflicts: plan.conflicts,
  keyPrefixRemaps: plan.keyPrefixRemaps,
  errors: plan.errors,
  fingerprint: plan.fingerprint
});

const sourceOption = (source: DefinitionSource) => ({
  kind: source.kind,
  id: source.id,
  name: source.name,
  description: source.description,
  category: source.category,
  schemas: source.schemas.map(schema => ({ id: schema.id, name: schema.name })),
  enums: source.enums.map(enumeration => ({ id: enumeration.id, name: enumeration.name })),
  documentTypes: source.documentTypes.map(type => ({ id: type.id, name: type.name })),
  relationSchemas: source.relationSchemas.map(schema => ({ id: schema.id, name: schema.name })),
  fieldGroups: source.fieldGroups.map(group => ({ id: group.id, name: group.name })),
  dashboardWidgets: source.dashboardWidgets
});

const canAdminister = async (db: DatabaseAdapter, workspace: string, event: AuthenticatedEvent) => {
  // Sources are listed across workspaces, so each candidate must be checked with its own context.
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  return (
    checker.hasGlobalPermission(authCtx, 'admin_platform') ||
    checker.hasWorkspaceCapability(authCtx, 'people.role')
  );
};

export const listDefinitionImportSources = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
) =>
  runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to retrieve definition import sources',
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceAdmin(authCtx, 'You must administer the destination workspace');
      const builtinSources = SCHEMA_TEMPLATES.map(template =>
        sourceOption(sourceFromBuiltin(template))
      );
      const workspaceSources = await Promise.all(
        (await db.workspace.listWorkspaces())
          .filter(item => item.id !== ws)
          .map(async item => {
            if (!(await canAdminister(db, item.id, event))) return null;
            return sourceOption(await sourceFromWorkspace(db, item.id));
          })
      );
      return [...builtinSources, ...workspaceSources.filter(item => item !== null)];
    }
  });

export const previewDefinitionImport = async (
  db: DatabaseAdapter,
  workspace: string,
  input: {
    source: DefinitionImportSource;
    selection: DefinitionImportSelection;
    renames: DefinitionImportRename[];
  },
  event: AuthenticatedEvent
) =>
  runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to preview definition import',
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceAdmin(authCtx, 'You must administer the destination workspace');
      return toPreview(
        await buildPlan(db, ws, input.source, input.selection, input.renames, event)
      );
    }
  });

export const executeDefinitionImport = async (
  db: DatabaseAdapter,
  workspace: string,
  input: DefinitionImportExecuteRequest,
  event: AuthenticatedEvent
): Promise<DefinitionImportExecuteResponse> =>
  runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to execute definition import',
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceAdmin(authCtx, 'You must administer the destination workspace');
      const plan = await buildPlan(db, ws, input.source, input.selection, input.renames, event);
      httpAssert.true(plan.errors.length === 0, { status: 409, message: plan.errors.join('; ') });
      httpAssert.true(plan.conflicts.length === 0, {
        status: 409,
        message: `Definition import conflicts: ${plan.conflicts.map(conflict => conflict.name).join(', ')}`
      });
      httpAssert.true(plan.fingerprint === input.fingerprint, {
        status: 409,
        message: 'The definition import preview is stale. Preview the import again.'
      });

      const expected = toPreview(plan);
      httpAssert.true(
        stableStringify({
          schemas: input.schemas,
          enums: input.enums,
          documentTypes: input.documentTypes,
          relationSchemas: input.relationSchemas,
          fieldGroups: input.fieldGroups,
          dashboardWidgets: input.dashboardWidgets,
          renames: input.renames,
          keyPrefixRemaps: input.keyPrefixRemaps
        }) ===
          stableStringify({
            schemas: expected.schemas,
            enums: expected.enums,
            documentTypes: expected.documentTypes,
            relationSchemas: expected.relationSchemas,
            fieldGroups: expected.fieldGroups,
            dashboardWidgets: expected.dashboardWidgets,
            renames: expected.renames,
            keyPrefixRemaps: expected.keyPrefixRemaps
          }),
        { status: 409, message: 'The definition import preview has changed. Preview again.' }
      );

      const schemaIdMap = new Map(plan.schemas.map(schema => [schema.id, randomUUID()]));
      const enumIdMap = new Map(plan.enums.map(enumeration => [enumeration.id, randomUUID()]));
      const relationSchemaIdMap = new Map(
        plan.relationSchemas.map(schema => [schema.id, randomUUID()])
      );
      const documentTypeIdMap = new Map(
        plan.documentTypes.map(documentType => [documentType.id, randomUUID()])
      );
      const sharedGroupSources = new Map<string, ImportableFieldGroup>();
      for (const schema of plan.schemas) {
        for (const group of schema.shared_field_groups) sharedGroupSources.set(group.id, group);
      }
      for (const relationSchema of plan.relationSchemas) {
        for (const group of relationSchema.shared_field_groups)
          sharedGroupSources.set(group.id, group);
      }
      for (const group of plan.fieldGroups) sharedGroupSources.set(group.id, group);
      const sharedFieldGroupMap = new Map(
        [...sharedGroupSources.keys()].map(id => [id, randomUUID()])
      );
      const selectedFieldGroupIdsForAudit = new Set(input.selection.fieldGroups);
      const targetTeams = await db.workspace.listTeams(ws);
      const targetTeamByName = new Map(targetTeams.map(team => [lower(team.name), team.id]));
      const teamIdMap = new Map(
        Object.entries((await getSource(db, ws, input.source, event)).teamNames).flatMap(
          ([sourceId, name]) => {
            const targetId = targetTeamByName.get(lower(name));
            return targetId ? [[sourceId, targetId] as const] : [];
          }
        )
      );
      const now = new Date();
      await db.core.transaction(async tx => {
        for (const enumeration of plan.enums) {
          const row: WorkspaceEnumDbCreate = {
            id: enumIdMap.get(enumeration.id)!,
            workspace: ws,
            name: enumeration.name,
            options: enumeration.options,
            sort_order: enumeration.sort_order,
            created_at: now,
            updated_at: now
          };
          await tx.catalog.createEnum(row);
          await writeAudit(tx, {
            userId: authCtx.userId,
            workspace: ws,
            operation: 'create',
            entityType: 'workspace_enum',
            entityId: row.id,
            entityName: row.name,
            changes: {
              new: { ...row, created_at: now.toISOString(), updated_at: now.toISOString() }
            },
            metadata: { importedFrom: input.source }
          });
        }

        for (const [sourceId, group] of sharedGroupSources) {
          const row: SharedFieldGroupDbCreate = {
            id: sharedFieldGroupMap.get(sourceId)!,
            workspace: ws,
            name: group.name,
            description: group.description,
            fields: group.fields,
            sort_order: group.sort_order,
            created_at: now,
            updated_at: now
          };
          await tx.catalog.createSharedFieldGroup(row);
          if (selectedFieldGroupIdsForAudit.has(sourceId)) {
            await writeAudit(tx, {
              userId: authCtx.userId,
              workspace: ws,
              operation: 'create',
              entityType: 'workspace_field_group',
              entityId: row.id,
              entityName: row.name,
              changes: {
                new: { ...row, created_at: now.toISOString(), updated_at: now.toISOString() }
              },
              metadata: { importedFrom: input.source }
            });
          }
        }

        for (const schema of plan.schemas) {
          const fields = schema.fields.map(field => {
            const resolvedField =
              field.groupId && sharedFieldGroupMap.has(field.groupId)
                ? { ...field, groupId: sharedFieldGroupMap.get(field.groupId)! }
                : field;
            if (isReferenceOrContainmentField(field)) {
              return {
                ...resolvedField,
                schemaId: schemaIdMap.get(field.schemaId) ?? field.schemaId
              };
            }
            if (field.type === 'typedRelation') {
              return {
                ...resolvedField,
                relationSchemaId:
                  relationSchemaIdMap.get(field.relationSchemaId) ?? field.relationSchemaId
              };
            }
            if (field.type === 'select') {
              return { ...resolvedField, enumId: enumIdMap.get(field.enumId) ?? field.enumId };
            }
            return resolvedField;
          });
          const groups = schema.groups.map(group => ({
            ...group,
            id: sharedFieldGroupMap.get(group.id) ?? group.id,
            accessControl: group.accessControl
              ? {
                  teamIds: group.accessControl.teamIds.map(id => teamIdMap.get(id) ?? id)
                }
              : undefined
          }));
          assertResolvedFieldGroupReferences(fields, groups);
          validateDerivedFieldGroupAccess(fields, groups);

          const row: SchemaDbCreate = {
            id: schemaIdMap.get(schema.id)!,
            workspace: ws,
            name: schema.name,
            category: schema.category,
            description: schema.description,
            key_prefix: schema.key_prefix,
            fields,
            groups,
            shared_field_group_links: schema.shared_field_group_links.map(link => ({
              ...link,
              groupId: sharedFieldGroupMap.get(link.groupId) ?? link.groupId,
              teamIds: link.teamIds?.map(id => teamIdMap.get(id) ?? id)
            })),
            templates: [],
            color: schema.color,
            icon: schema.icon,
            default_owner: schema.default_owner_name
              ? ((await tx.workspace.listTeams(ws)).find(
                  team => lower(team.name) === lower(schema.default_owner_name!)
                )?.id ?? null)
              : null,
            created_at: now,
            updated_at: now
          };
          await tx.catalog.createSchema(row);
          await tx.workspace.registerPublicIdPrefix(row.key_prefix, 'schema', row.id, now);
          await tx.catalog.createSchemaVersion({
            id: randomUUID(),
            workspace: ws,
            schema_id: row.id,
            version: 1,
            name: row.name,
            category: row.category ?? null,
            description: row.description,
            fields,
            templates: [],
            groups,
            color: row.color,
            icon: row.icon,
            change_summary: buildFieldChangeSummary(null, toSchemaFieldMigrationFields(fields)),
            created_by: authCtx.userId,
            created_at: now
          });
          await writeAudit(tx, {
            userId: authCtx.userId,
            workspace: ws,
            operation: 'create',
            entityType: 'entity_schema',
            entityId: row.id,
            entityName: row.name,
            changes: {
              new: { ...row, created_at: now.toISOString(), updated_at: now.toISOString() }
            },
            metadata: { importedFrom: input.source }
          });
        }

        for (const relationSchema of plan.relationSchemas) {
          const fields = relationSchema.fields.map(field => {
            if (field.groupId && sharedFieldGroupMap.has(field.groupId)) {
              return { ...field, groupId: sharedFieldGroupMap.get(field.groupId)! };
            }
            if (isEntityRelationField(field)) {
              return { ...field, schemaId: schemaIdMap.get(field.schemaId) ?? field.schemaId };
            }
            if (field.type === 'select') {
              return { ...field, enumId: enumIdMap.get(field.enumId) ?? field.enumId };
            }
            return field;
          }) as RelationField[];
          const groups = relationSchema.groups.map(group => ({
            ...group,
            id: sharedFieldGroupMap.get(group.id) ?? group.id,
            accessControl: group.accessControl
              ? {
                  teamIds: group.accessControl.teamIds.map(id => teamIdMap.get(id) ?? id)
                }
              : undefined
          }));
          // Relation fields have no 'derived' type by design, so validateDerivedFieldGroupAccess
          // (which only matters for derived fields) is intentionally not called here.
          assertResolvedFieldGroupReferences(fields, groups);

          const row: RelationSchemaDbCreate = {
            id: relationSchemaIdMap.get(relationSchema.id)!,
            workspace: ws,
            name: relationSchema.name,
            category: relationSchema.category,
            description: relationSchema.description,
            in_schema_ids:
              relationSchema.in_schema_ids === 'any'
                ? ('any' as const)
                : relationSchema.in_schema_ids.map(id => schemaIdMap.get(id) ?? id),
            out_schema_ids:
              relationSchema.out_schema_ids === 'any'
                ? ('any' as const)
                : relationSchema.out_schema_ids.map(id => schemaIdMap.get(id) ?? id),
            in_label: relationSchema.in_label ?? null,
            out_label: relationSchema.out_label ?? null,
            fields,
            groups,
            shared_field_group_links: relationSchema.shared_field_group_links.map(link => ({
              ...link,
              groupId: sharedFieldGroupMap.get(link.groupId) ?? link.groupId,
              teamIds: link.teamIds?.map(id => teamIdMap.get(id) ?? id)
            })),
            color: relationSchema.color,
            icon: relationSchema.icon,
            relation_approval_policy: relationSchema.relation_approval_policy,
            created_at: now,
            updated_at: now
          };
          await tx.relation.createRelationSchema(row);
          await tx.relation.createRelationSchemaVersion({
            id: randomUUID(),
            workspace: ws,
            schema_id: row.id,
            version: 1,
            name: row.name,
            category: row.category ?? null,
            description: row.description,
            in_schema_ids: row.in_schema_ids,
            out_schema_ids: row.out_schema_ids,
            in_label: row.in_label,
            out_label: row.out_label,
            fields,
            groups,
            color: row.color,
            icon: row.icon,
            change_summary: buildFieldChangeSummary(null, toRelationFieldMigrationFields(fields)),
            created_by: authCtx.userId,
            created_at: now
          });
          await writeAudit(tx, {
            userId: authCtx.userId,
            workspace: ws,
            operation: 'create',
            entityType: 'relation_schema',
            entityId: row.id,
            entityName: row.name,
            changes: {
              new: { ...row, created_at: now.toISOString(), updated_at: now.toISOString() }
            },
            metadata: { importedFrom: input.source }
          });
        }

        for (const documentType of plan.documentTypes) {
          const id = documentTypeIdMap.get(documentType.id)!;
          await tx.document.createDocumentType({
            id,
            workspace: ws,
            name: documentType.name,
            description: documentType.description,
            fields: documentType.fields,
            aiActions: documentType.aiActions,
            color: documentType.color,
            icon: documentType.icon,
            created_at: now,
            updated_at: now
          });
          await tx.document.createDocumentTypeVersion({
            id: randomUUID(),
            workspace: ws,
            document_type_id: id,
            version: 1,
            name: documentType.name,
            description: documentType.description,
            fields: documentType.fields,
            aiActions: documentType.aiActions,
            color: documentType.color,
            icon: documentType.icon,
            change_summary: { imported: true },
            created_by: authCtx.userId,
            created_at: now
          });
        }

        for (const configuration of plan.capabilityConfigurations) {
          const bindings = Object.fromEntries(
            Object.entries(configuration.bindings).map(([bindingId, binding]) => {
              const targetId =
                binding.target.kind === 'entity_schema'
                  ? schemaIdMap.get(binding.target.id)
                  : binding.target.kind === 'relation_schema'
                    ? relationSchemaIdMap.get(binding.target.id)
                    : documentTypeIdMap.get(binding.target.id);
              return [
                bindingId,
                {
                  ...binding,
                  target: { ...binding.target, id: targetId ?? binding.target.id }
                }
              ];
            })
          ) as WorkspaceCapabilityBindings;
          await tx.workspace.upsertWorkspaceCapabilityConfiguration({
            id: randomUUID(),
            workspace: ws,
            type: configuration.type,
            bindings,
            created_at: now,
            updated_at: now
          });
        }

        if (plan.dashboardWidgets.length > 0) {
          const widgets = resolveTemplateDashboardWidgets(plan.dashboardWidgets, schemaIdMap);
          const builtinTemplate =
            plan.source.kind === 'builtin'
              ? SCHEMA_TEMPLATES.find(template => template.id === plan.source.id)
              : undefined;
          if (builtinTemplate?.category === 'cross-cutting') {
            await appendWorkspaceDashboardLayout(
              tx,
              ws,
              builtinTemplate.name,
              widgets,
              authCtx.userId
            );
          } else {
            await replaceDefaultWorkspaceDashboardLayout(tx, ws, widgets, authCtx.userId);
          }
        }
      });

      return {
        schemas: plan.schemas.length,
        enums: plan.enums.length,
        documentTypes: plan.documentTypes.length,
        relationSchemas: plan.relationSchemas.length,
        fieldGroups: plan.fieldGroups.length,
        dashboardWidgets: plan.dashboardWidgets.length
      };
    }
  });
