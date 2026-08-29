import { createHash, randomUUID } from 'node:crypto';
import type {
  DefinitionImportExecuteRequest,
  DefinitionImportExecuteResponse,
  DefinitionImportPreview,
  DefinitionImportRename,
  DefinitionImportSelection,
  DefinitionImportSource,
  DefinitionImportDependencyMapping,
  TemplateDependencyDescriptor
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
  getTemplateDependencyDescriptors,
  type TemplateDependencyKind,
  resolveTemplateDashboardWidgets,
  type SchemaTemplate,
  type SymbolicField,
  type SymbolicReference
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

type ImportableSchemaPatch = {
  ownerId: string;
  target: string;
  fields: SchemaField[];
};

type PlannedSchemaPatch = {
  targetSchemaId: string;
  targetSchemaName: string;
  fields: SchemaField[];
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
  dependencies: TemplateDependencyDescriptor[];
  schemaPatches: ImportableSchemaPatch[];
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
  dependencyMappings: DefinitionImportDependencyMapping[];
  schemaPatches: PlannedSchemaPatch[];
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

const dependencyReferencePrefix = '__template_dependency__:';
const dependencyReference = (id: string) => `${dependencyReferencePrefix}${id}`;
const isDependencyReference = (id: string) => id.startsWith(dependencyReferencePrefix);

const sourceDefinitionId = (ownerId: string, rootTemplateId: string, symbolicId: string) =>
  ownerId === rootTemplateId ? symbolicId : `${ownerId}:${symbolicId}`;

const symbolicReferenceId = (
  reference: SymbolicReference,
  ownerId: string,
  rootTemplateId: string
): string => {
  if (typeof reference === 'string') return reference;
  if ('dependencyId' in reference) {
    return dependencyReference(`${ownerId}:${reference.dependencyId}`);
  }
  return sourceDefinitionId(reference.templateId, rootTemplateId, reference.symId);
};

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

const toCanonicalField = (
  field: SymbolicField,
  ownerId: string,
  rootTemplateId: string
): SchemaField => {
  if (field.type === 'reference') {
    return {
      id: field.id,
      name: field.name,
      predicate: field.predicate,
      type: 'reference',
      schemaId: symbolicReferenceId(field.symSchemaId, ownerId, rootTemplateId),
      minCount: field.minCount,
      maxCount: field.maxCount,
      requirementLevel: field.minCount > 0 ? 'required' : 'optional'
    };
  }
  if (field.type === 'containment') {
    return {
      id: field.id,
      name: field.name,
      predicate: field.predicate,
      type: 'containment',
      schemaId: symbolicReferenceId(field.symSchemaId, ownerId, rootTemplateId),
      minCount: field.minCount,
      maxCount: field.maxCount,
      requirementLevel: field.minCount > 0 ? 'required' : 'optional'
    };
  }
  if (field.type === 'typedRelation') {
    return {
      id: field.id,
      name: field.name,
      type: 'typedRelation',
      relationSchemaId: symbolicReferenceId(field.symRelationSchemaId, ownerId, rootTemplateId),
      direction: field.direction,
      minCount: field.minCount,
      maxCount: field.maxCount,
      ...(field.requirementLevel === undefined ? {} : { requirementLevel: field.requirementLevel })
    };
  }
  if (field.type === 'select') {
    return {
      ...field,
      enumId: symbolicReferenceId(field.enumId, ownerId, rootTemplateId)
    };
  }
  if (field.type === 'derived' && field.enumId !== undefined) {
    return {
      ...field,
      requirementLevel: 'optional',
      enumId: symbolicReferenceId(field.enumId, ownerId, rootTemplateId)
    };
  }
  return field as SchemaField;
};

const toCanonicalRelationField = (
  field: NonNullable<SchemaTemplate['relationSchemas']>[number]['fields'][number],
  ownerId: string,
  rootTemplateId: string
): RelationField => {
  const requirement =
    field.requirementLevel === undefined ? {} : { requirementLevel: field.requirementLevel };

  if (field.type === 'select') {
    return {
      id: field.id,
      name: field.name,
      type: field.type,
      enumId: symbolicReferenceId(field.enumId, ownerId, rootTemplateId),
      ...(field.minCardinality === undefined ? {} : { minCardinality: field.minCardinality }),
      ...(field.maxCardinality === undefined ? {} : { maxCardinality: field.maxCardinality }),
      ...requirement
    };
  }
  if (field.type === 'number') {
    return {
      id: field.id,
      name: field.name,
      type: field.type,
      ...(field.min === undefined ? {} : { min: field.min }),
      ...(field.max === undefined ? {} : { max: field.max }),
      ...requirement
    };
  }
  if (field.type === 'entityRelation') {
    return {
      id: field.id,
      name: field.name,
      type: field.type,
      ...(field.predicate === undefined ? {} : { predicate: field.predicate }),
      schemaId: symbolicReferenceId(field.schemaId, ownerId, rootTemplateId),
      minCount: field.minCount,
      maxCount: field.maxCount,
      ...requirement
    };
  }
  return {
    id: field.id,
    name: field.name,
    type: field.type,
    ...requirement
  };
};

const sourceFromBuiltin = (template: SchemaTemplate): DefinitionSource => {
  const rootOwnerId = template.id;
  const fieldGroupSources = new Map(
    (template.fieldGroups ?? []).map((fieldGroup, index) => [
      fieldGroup.id,
      {
        id: fieldGroup.id,
        name: fieldGroup.name,
        description: fieldGroup.description ?? null,
        fields: fieldGroup.fields.map(field => toCanonicalField(field, rootOwnerId, template.id)),
        sort_order: index
      } satisfies ImportableFieldGroup
    ])
  );
  const canonicalSharedFieldGroupLinks = (
    references: SymbolicReference[] | undefined,
    ownerId: string
  ): SharedFieldGroupLink[] =>
    (references ?? []).map(reference => ({
      groupId: symbolicReferenceId(reference, ownerId, template.id)
    }));
  const sharedGroupsFor = (links: SharedFieldGroupLink[]) =>
    links.flatMap(link => {
      const group = fieldGroupSources.get(link.groupId);
      return group ? [{ ...group, fields: [...group.fields] }] : [];
    });
  const schemaSource = (schema: SchemaTemplate['schemas'][number], ownerId: string) => {
    const sharedFieldGroupLinks = canonicalSharedFieldGroupLinks(
      schema.sharedFieldGroupIds,
      ownerId
    );
    return {
      id: sourceDefinitionId(ownerId, template.id, schema.symId),
      name: schema.name,
      category: null,
      description: schema.description,
      key_prefix: schema.symId
        .replace(/[^a-z]/gi, '')
        .slice(0, 5)
        .toUpperCase(),
      fields: schema.fields.map(field => toCanonicalField(field, ownerId, template.id)),
      groups: [],
      shared_field_group_links: sharedFieldGroupLinks,
      shared_field_groups: sharedGroupsFor(sharedFieldGroupLinks),
      color: schema.color,
      icon: schema.icon,
      default_owner_name: null,
      entity_approval_policy: 'disabled' as const,
      deprecation_policy: 'disabled' as const
    } satisfies ImportableSchema;
  };
  const relationSchemaSource = (
    relationSchema: NonNullable<SchemaTemplate['relationSchemas']>[number],
    ownerId: string
  ) => {
    const sharedFieldGroupLinks = canonicalSharedFieldGroupLinks(
      relationSchema.sharedFieldGroupIds,
      ownerId
    );
    return {
      id: sourceDefinitionId(ownerId, template.id, relationSchema.symId),
      name: relationSchema.name,
      category: null,
      description: relationSchema.description,
      in_schema_ids:
        relationSchema.inSymSchemaIds === 'any'
          ? 'any'
          : relationSchema.inSymSchemaIds.map(reference =>
              symbolicReferenceId(reference, ownerId, template.id)
            ),
      out_schema_ids:
        relationSchema.outSymSchemaIds === 'any'
          ? 'any'
          : relationSchema.outSymSchemaIds.map(reference =>
              symbolicReferenceId(reference, ownerId, template.id)
            ),
      in_label: relationSchema.inLabel,
      out_label: relationSchema.outLabel,
      fields: relationSchema.fields.map(field =>
        toCanonicalRelationField(field, ownerId, template.id)
      ),
      groups: [],
      shared_field_group_links: sharedFieldGroupLinks,
      shared_field_groups: sharedGroupsFor(sharedFieldGroupLinks),
      color: relationSchema.color,
      icon: relationSchema.icon,
      relation_approval_policy: 'disabled' as const
    } satisfies ImportableRelationSchema;
  };
  const extensionSources = (template.compositionExtensions ?? []).flatMap(extension => {
    const ownerId = `${template.id}:${extension.id}`;
    return {
      ownerId,
      relationSchemas: (extension.relationSchemas ?? []).map(relationSchema =>
        relationSchemaSource(relationSchema, ownerId)
      ),
      schemaPatches: (extension.schemaFields ?? []).map(patch => ({
        ownerId,
        target: symbolicReferenceId(patch.target, ownerId, template.id),
        fields: patch.fields.map(field => toCanonicalField(field, ownerId, template.id))
      }))
    };
  });
  const dependencies = getTemplateDependencyDescriptors(template).map(dependency => ({
    id: dependency.key,
    owner_id: dependency.ownerId,
    name: dependency.name,
    description: dependency.description,
    target_kind: dependency.kind,
    min_targets: dependency.minTargets,
    ...(dependency.maxTargets === undefined ? {} : { max_targets: dependency.maxTargets }),
    required_template_ids: dependency.requiredTemplateIds,
    required_template_categories: dependency.requiredTemplateCategories,
    required_by: dependency.requiredBy.map(definition => ({
      kind: definition.kind,
      id: sourceDefinitionId(definition.templateId, template.id, definition.symbolicId),
      name: definition.name,
      template_id: definition.templateId,
      symbolic_id: definition.symbolicId
    }))
  }));
  const schemas = template.schemas.map(schema => schemaSource(schema, rootOwnerId));
  const enums = template.enums.map((enumeration, index) => ({
    id: enumeration.id,
    name: enumeration.name,
    options: enumeration.options,
    sort_order: index
  }));
  const fieldGroups = [...fieldGroupSources.values()];
  const documentTypes = template.documentTypes.map(documentType => ({
    id: documentType.id,
    name: documentType.name,
    description: documentType.description,
    fields: documentType.fields,
    aiActions: [],
    color: documentType.color,
    icon: documentType.icon
  }));
  const relationSchemas = [
    ...(template.relationSchemas ?? []).map(relationSchema =>
      relationSchemaSource(relationSchema, rootOwnerId)
    ),
    ...extensionSources.flatMap(extension => extension.relationSchemas)
  ];

  return {
    kind: 'builtin',
    id: template.id,
    name: template.name,
    description: template.description,
    category: template.category,
    schemas,
    enums,
    documentTypes,
    relationSchemas,
    fieldGroups,
    capabilityConfigurations: (template.capabilityConfigurations ?? []).map(
      (configuration, index) => ({
        id: `${template.id}:${configuration.type}:${index}`,
        type: configuration.type,
        bindings: Object.fromEntries(
          Object.entries(configuration.bindings).map(([bindingId, binding]) => [
            bindingId,
            {
              ...binding,
              target: {
                kind: binding.target.kind,
                id: symbolicReferenceId(binding.target.symId, rootOwnerId, template.id)
              }
            }
          ])
        ) as WorkspaceCapabilityBindings
      })
    ),
    dashboardWidgets: template.dashboardWidgets ?? [],
    dependencies,
    schemaPatches: extensionSources.flatMap(extension => extension.schemaPatches),
    teamNames: {}
  };
};

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
    capabilityConfigurations,
    categories
  ] = await Promise.all([
    db.catalog.listSchemas(workspace),
    db.catalog.listEnums(workspace),
    db.document.listDocumentTypes(workspace, true),
    db.workspace.listTeams(workspace),
    db.catalog.listSharedFieldGroups(workspace),
    getSchemaGovernancePoliciesBySchema(db, workspace),
    db.relation.listRelationSchemas(workspace),
    db.workspace.listWorkspaceCapabilityConfigurations(workspace),
    db.catalog.listCategories(workspace)
  ]);
  const teamNames = new Map(teams.map(team => [team.id, team.name]));
  const categoryNamesById = new Map(categories.map(category => [category.id, category.name]));

  return {
    kind: 'workspace',
    id: workspaceRow.id,
    name: workspaceRow.name,
    description: workspaceRow.description,
    schemas: schemas.map(schema => ({
      id: schema.id,
      name: schema.name,
      category: (schema.category_id && categoryNamesById.get(schema.category_id)) ?? null,
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
      category: (schema.category_id && categoryNamesById.get(schema.category_id)) ?? null,
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
    dependencies: [],
    schemaPatches: [],
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

const dependencyIdFromReference = (reference: string) =>
  reference.slice(dependencyReferencePrefix.length);

const addUniqueError = (errors: string[], message: string) => {
  if (!errors.includes(message)) errors.push(message);
};

const validateDependencyMappings = (
  source: DefinitionSource,
  mappings: DefinitionImportDependencyMapping[],
  activeDependencyIds: ReadonlySet<string>,
  targetIdsByKind: ReadonlyMap<TemplateDependencyKind, ReadonlySet<string>>,
  errors: string[]
) => {
  const descriptors = new Map(source.dependencies.map(dependency => [dependency.id, dependency]));
  const mappingsById = new Map<string, DefinitionImportDependencyMapping>();
  for (const mapping of mappings) {
    if (mappingsById.has(mapping.dependencyId)) {
      addUniqueError(errors, `Multiple mappings were provided for '${mapping.dependencyId}'`);
      continue;
    }
    mappingsById.set(mapping.dependencyId, mapping);
    if (!descriptors.has(mapping.dependencyId)) {
      addUniqueError(
        errors,
        `Template dependency '${mapping.dependencyId}' is not active in the import source`
      );
    }
  }

  for (const dependencyId of activeDependencyIds) {
    const dependency = descriptors.get(dependencyId);
    if (!dependency) {
      addUniqueError(errors, `Template dependency '${dependencyId}' was not found in the source`);
      continue;
    }
    const mapping = mappingsById.get(dependencyId);
    if (!mapping) {
      addUniqueError(
        errors,
        `Template dependency '${dependencyId}' requires a mapping to destination definitions`
      );
      continue;
    }
    if (mapping.targetIds.length < dependency.min_targets) {
      addUniqueError(
        errors,
        `Template dependency '${dependencyId}' requires at least ${dependency.min_targets} target${dependency.min_targets === 1 ? '' : 's'}`
      );
    }
    if (dependency.max_targets !== undefined && mapping.targetIds.length > dependency.max_targets) {
      addUniqueError(
        errors,
        `Template dependency '${dependencyId}' accepts at most ${dependency.max_targets} target${dependency.max_targets === 1 ? '' : 's'}`
      );
    }
    if (new Set(mapping.targetIds).size !== mapping.targetIds.length) {
      addUniqueError(errors, `Template dependency '${dependencyId}' contains duplicate targets`);
    }
    const targetIds = targetIdsByKind.get(dependency.target_kind) ?? new Set<string>();
    for (const targetId of mapping.targetIds) {
      if (!targetIds.has(targetId)) {
        addUniqueError(
          errors,
          `Template dependency '${dependencyId}' targets unknown ${dependency.target_kind} '${targetId}' in the destination workspace`
        );
      }
    }
  }

  return { descriptors, mappingsById };
};

const resolveImportReferenceId = (
  kind: TemplateDependencyKind,
  reference: string,
  mappingsById: ReadonlyMap<string, DefinitionImportDependencyMapping>,
  descriptors: ReadonlyMap<string, TemplateDependencyDescriptor>,
  errors: string[]
) => {
  if (!isDependencyReference(reference)) return reference;
  const dependencyId = dependencyIdFromReference(reference);
  const dependency = descriptors.get(dependencyId);
  if (!dependency) {
    addUniqueError(errors, `Template dependency '${dependencyId}' was not found in the source`);
    return reference;
  }
  if (dependency.target_kind !== kind) {
    addUniqueError(
      errors,
      `Template dependency '${dependencyId}' targets ${dependency.target_kind}, not ${kind}`
    );
    return reference;
  }
  const mapping = mappingsById.get(dependencyId);
  if (!mapping) return reference;
  if (mapping.targetIds.length !== 1) {
    addUniqueError(
      errors,
      `Template dependency '${dependencyId}' requires exactly one target for this reference`
    );
    return reference;
  }
  return mapping.targetIds[0]!;
};

const resolveImportReferenceIds = (
  kind: TemplateDependencyKind,
  references: string[],
  mappingsById: ReadonlyMap<string, DefinitionImportDependencyMapping>,
  descriptors: ReadonlyMap<string, TemplateDependencyDescriptor>,
  errors: string[]
) =>
  references.flatMap(reference => {
    if (!isDependencyReference(reference)) return [reference];
    const dependencyId = dependencyIdFromReference(reference);
    const dependency = descriptors.get(dependencyId);
    if (!dependency) {
      addUniqueError(errors, `Template dependency '${dependencyId}' was not found in the source`);
      return [reference];
    }
    if (dependency.target_kind !== kind) {
      addUniqueError(
        errors,
        `Template dependency '${dependencyId}' targets ${dependency.target_kind}, not ${kind}`
      );
      return [reference];
    }
    const mapping = mappingsById.get(dependencyId);
    return mapping?.targetIds ?? [reference];
  });

const resolveImportField = (
  field: SchemaField,
  mappingsById: ReadonlyMap<string, DefinitionImportDependencyMapping>,
  descriptors: ReadonlyMap<string, TemplateDependencyDescriptor>,
  errors: string[]
): SchemaField => {
  const groupId = field.groupId
    ? resolveImportReferenceId('fieldGroup', field.groupId, mappingsById, descriptors, errors)
    : field.groupId;
  if (isReferenceOrContainmentField(field)) {
    return {
      ...field,
      ...(groupId === undefined ? {} : { groupId }),
      schemaId: resolveImportReferenceId(
        'schema',
        field.schemaId,
        mappingsById,
        descriptors,
        errors
      )
    };
  }
  if (field.type === 'typedRelation') {
    return {
      ...field,
      ...(groupId === undefined ? {} : { groupId }),
      relationSchemaId: resolveImportReferenceId(
        'relationSchema',
        field.relationSchemaId,
        mappingsById,
        descriptors,
        errors
      )
    };
  }
  if (field.type === 'select') {
    return {
      ...field,
      ...(groupId === undefined ? {} : { groupId }),
      enumId: resolveImportReferenceId('enum', field.enumId, mappingsById, descriptors, errors)
    };
  }
  if (field.type === 'derived' && field.enumId !== undefined) {
    return {
      ...field,
      ...(groupId === undefined ? {} : { groupId }),
      enumId: resolveImportReferenceId('enum', field.enumId, mappingsById, descriptors, errors)
    };
  }
  return groupId === undefined ? field : { ...field, groupId };
};

const resolveImportRelationField = (
  field: RelationField,
  mappingsById: ReadonlyMap<string, DefinitionImportDependencyMapping>,
  descriptors: ReadonlyMap<string, TemplateDependencyDescriptor>,
  errors: string[]
): RelationField => {
  const groupId = field.groupId
    ? resolveImportReferenceId('fieldGroup', field.groupId, mappingsById, descriptors, errors)
    : field.groupId;
  if (isEntityRelationField(field)) {
    return {
      ...field,
      ...(groupId === undefined ? {} : { groupId }),
      schemaId: resolveImportReferenceId(
        'schema',
        field.schemaId,
        mappingsById,
        descriptors,
        errors
      )
    };
  }
  if (field.type === 'select') {
    return {
      ...field,
      ...(groupId === undefined ? {} : { groupId }),
      enumId: resolveImportReferenceId('enum', field.enumId, mappingsById, descriptors, errors)
    };
  }
  return groupId === undefined ? field : { ...field, groupId };
};

const buildPlan = async (
  db: DatabaseAdapter,
  targetWorkspace: string,
  source: DefinitionImportSource,
  selection: DefinitionImportSelection,
  renames: DefinitionImportRename[],
  dependencyMappings: DefinitionImportDependencyMapping[],
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
          if (!isDependencyReference(field.schemaId) && !schemaById.has(field.schemaId)) {
            errors.push(`Schema '${schema.name}' references missing schema '${field.schemaId}'`);
          } else if (!isDependencyReference(field.schemaId)) {
            schemaQueue.push(field.schemaId);
          }
        } else if (field.type === 'typedRelation') {
          if (
            !isDependencyReference(field.relationSchemaId) &&
            !relationSchemaById.has(field.relationSchemaId)
          ) {
            errors.push(
              `Schema '${schema.name}' references missing relation schema '${field.relationSchemaId}'`
            );
          } else if (!isDependencyReference(field.relationSchemaId)) {
            relationSchemaQueue.push(field.relationSchemaId);
          }
        } else if (field.type === 'select') {
          if (!isDependencyReference(field.enumId) && !enumById.has(field.enumId)) {
            errors.push(`Schema '${schema.name}' references missing enum '${field.enumId}'`);
          } else if (!isDependencyReference(field.enumId)) {
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
        if (!isDependencyReference(schemaId) && !schemaById.has(schemaId)) {
          errors.push(
            `Relation schema '${relationSchema.name}' references missing schema '${schemaId}'`
          );
        } else if (!isDependencyReference(schemaId)) {
          schemaQueue.push(schemaId);
        }
      }
      for (const field of relationSchema.fields) {
        if (isEntityRelationField(field)) {
          if (!isDependencyReference(field.schemaId) && !schemaById.has(field.schemaId)) {
            errors.push(
              `Relation schema '${relationSchema.name}' references missing schema '${field.schemaId}'`
            );
          } else if (!isDependencyReference(field.schemaId)) {
            schemaQueue.push(field.schemaId);
          }
        } else if (field.type === 'select') {
          if (!isDependencyReference(field.enumId) && !enumById.has(field.enumId)) {
            errors.push(
              `Relation schema '${relationSchema.name}' references missing enum '${field.enumId}'`
            );
          } else if (!isDependencyReference(field.enumId)) {
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
      continue;
    }
    try {
      validateDerivedFieldGroupAccess(relationSchema.fields, relationSchema.groups, 'relation');
    } catch (error) {
      errors.push(
        error instanceof Error
          ? `Relation schema '${relationSchema.name}': ${error.message}`
          : String(error)
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

  const activeDependencyIds = new Set<string>();
  const collectDependencyReference = (reference: string) => {
    if (isDependencyReference(reference))
      activeDependencyIds.add(dependencyIdFromReference(reference));
  };
  const collectSchemaFieldDependencies = (field: SchemaField) => {
    collectDependencyReference(field.groupId ?? '');
    if (isReferenceOrContainmentField(field)) collectDependencyReference(field.schemaId);
    else if (field.type === 'typedRelation') collectDependencyReference(field.relationSchemaId);
    else if (field.type === 'select') collectDependencyReference(field.enumId);
    else if (field.type === 'derived' && field.enumId !== undefined)
      collectDependencyReference(field.enumId);
  };
  const collectRelationFieldDependencies = (field: RelationField) => {
    collectDependencyReference(field.groupId ?? '');
    if (isEntityRelationField(field)) collectDependencyReference(field.schemaId);
    else if (field.type === 'select') collectDependencyReference(field.enumId);
  };
  for (const schema of schemas) {
    for (const field of schema.fields) collectSchemaFieldDependencies(field);
    for (const link of schema.shared_field_group_links) collectDependencyReference(link.groupId);
  }
  for (const relationSchema of relationSchemas) {
    for (const schemaId of [
      ...(relationSchema.in_schema_ids === 'any' ? [] : relationSchema.in_schema_ids),
      ...(relationSchema.out_schema_ids === 'any' ? [] : relationSchema.out_schema_ids)
    ]) {
      collectDependencyReference(schemaId);
    }
    for (const field of relationSchema.fields) collectRelationFieldDependencies(field);
    for (const link of relationSchema.shared_field_group_links)
      collectDependencyReference(link.groupId);
  }
  for (const fieldGroup of fieldGroups) {
    for (const field of fieldGroup.fields) collectSchemaFieldDependencies(field);
  }
  const isSelectedDefinition = (definition: TemplateDependencyDescriptor['required_by'][number]) =>
    definition.kind === 'schema'
      ? resolvedSchemaIds.has(definition.id)
      : definition.kind === 'relationSchema'
        ? resolvedRelationSchemaIds.has(definition.id)
        : definition.kind === 'enum'
          ? resolvedEnumIds.has(definition.id)
          : definition.kind === 'fieldGroup'
            ? selectedFieldGroupIds.has(definition.id)
            : selectedDocumentTypeIds.has(definition.id);
  const activeExtensionOwners = new Set(
    sourceData.dependencies
      .filter(dependency => dependency.required_by.some(isSelectedDefinition))
      .map(dependency => dependency.owner_id)
  );
  for (const patch of sourceData.schemaPatches) {
    if (!activeExtensionOwners.has(patch.ownerId)) continue;
    collectDependencyReference(patch.target);
    for (const field of patch.fields) collectSchemaFieldDependencies(field);
  }
  const targetIdsByKind = new Map<TemplateDependencyKind, ReadonlySet<string>>([
    ['schema', new Set(existingSchemas.map(schema => schema.id))],
    ['enum', new Set(existingEnums.map(enumeration => enumeration.id))],
    ['documentType', new Set(existingDocumentTypes.map(documentType => documentType.id))],
    ['relationSchema', new Set(existingRelationSchemas.map(schema => schema.id))],
    ['fieldGroup', new Set(existingFieldGroups.map(group => group.id))]
  ]);
  const { descriptors, mappingsById } = validateDependencyMappings(
    sourceData,
    dependencyMappings,
    activeDependencyIds,
    targetIdsByKind,
    errors
  );

  const mappedSchemas = schemas.map(schema => ({
    ...schema,
    fields: schema.fields.map(field =>
      resolveImportField(field, mappingsById, descriptors, errors)
    ),
    shared_field_group_links: schema.shared_field_group_links.flatMap(link =>
      resolveImportReferenceIds(
        'fieldGroup',
        [link.groupId],
        mappingsById,
        descriptors,
        errors
      ).map(groupId => ({ ...link, groupId }))
    )
  }));
  const mappedRelationSchemas = relationSchemas.map(relationSchema => ({
    ...relationSchema,
    in_schema_ids:
      relationSchema.in_schema_ids === 'any'
        ? ('any' as const)
        : resolveImportReferenceIds(
            'schema',
            relationSchema.in_schema_ids,
            mappingsById,
            descriptors,
            errors
          ),
    out_schema_ids:
      relationSchema.out_schema_ids === 'any'
        ? ('any' as const)
        : resolveImportReferenceIds(
            'schema',
            relationSchema.out_schema_ids,
            mappingsById,
            descriptors,
            errors
          ),
    fields: relationSchema.fields.map(field =>
      resolveImportRelationField(field, mappingsById, descriptors, errors)
    ),
    shared_field_group_links: relationSchema.shared_field_group_links.flatMap(link =>
      resolveImportReferenceIds(
        'fieldGroup',
        [link.groupId],
        mappingsById,
        descriptors,
        errors
      ).map(groupId => ({ ...link, groupId }))
    )
  }));
  const mappedFieldGroups = fieldGroups.map(group => ({
    ...group,
    fields: group.fields.map(field => resolveImportField(field, mappingsById, descriptors, errors))
  }));
  const mappedCapabilityConfigurations = capabilityConfigurations.map(configuration => ({
    ...configuration,
    bindings: Object.fromEntries(
      Object.entries(configuration.bindings).map(([bindingId, binding]) => {
        const kind =
          binding.target.kind === 'entity_schema'
            ? 'schema'
            : binding.target.kind === 'relation_schema'
              ? 'relationSchema'
              : 'documentType';
        return [
          bindingId,
          {
            ...binding,
            target: {
              ...binding.target,
              id: resolveImportReferenceId(
                kind,
                binding.target.id,
                mappingsById,
                descriptors,
                errors
              )
            }
          }
        ];
      })
    ) as WorkspaceCapabilityBindings
  }));

  const existingSchemaById = new Map(existingSchemas.map(schema => [schema.id, schema]));
  const schemaPatches: PlannedSchemaPatch[] = [];
  for (const patch of sourceData.schemaPatches) {
    if (!activeExtensionOwners.has(patch.ownerId)) continue;
    const targetSchemaIds = resolveImportReferenceIds(
      'schema',
      [patch.target],
      mappingsById,
      descriptors,
      errors
    );
    for (const targetSchemaId of targetSchemaIds) {
      const targetSchema =
        existingSchemaById.get(targetSchemaId) ??
        mappedSchemas.find(schema => schema.id === targetSchemaId);
      if (!targetSchema) {
        addUniqueError(
          errors,
          `Schema patch target '${targetSchemaId}' was not found in the source or destination`
        );
        continue;
      }
      const fields = patch.fields.map(field =>
        resolveImportField(field, mappingsById, descriptors, errors)
      );
      const existingFieldIds = new Set(targetSchema.fields.map(field => field.id));
      const patchFieldIds = new Set<string>();
      for (const field of fields) {
        if (existingFieldIds.has(field.id) || patchFieldIds.has(field.id)) {
          addUniqueError(
            errors,
            `Schema patch '${targetSchema.name}' adds duplicate field '${field.id}'`
          );
        }
        patchFieldIds.add(field.id);
      }
      schemaPatches.push({
        targetSchemaId,
        targetSchemaName: targetSchema.name,
        fields
      });
    }
  }
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
  checkNames('schema', mappedSchemas, existingSchemas);
  checkNames('enum', enums, existingEnums);
  checkNames('documentType', documentTypes, existingDocumentTypes);
  checkNames('relationSchema', mappedRelationSchemas, existingRelationSchemas);
  checkNames('fieldGroup', mappedFieldGroups, existingFieldGroups);

  const usedPrefixes = new Set(existingSchemas.map(schema => lower(schema.key_prefix)));
  const keyPrefixRemaps: DefinitionImportPlan['keyPrefixRemaps'] = [];
  const resolvedSchemas = [] as ImportableSchema[];
  for (const schema of mappedSchemas) {
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
    relationSchemas: mappedRelationSchemas.map(schema => ({
      id: schema.id,
      name: schema.name,
      dependency: !selectedRelationSchemaIds.has(schema.id),
      definition: schema
    })),
    fieldGroups: mappedFieldGroups.map(group => ({
      id: group.id,
      name: group.name,
      dependency: false,
      definition: group
    })),
    capabilityConfigurations: mappedCapabilityConfigurations,
    dependencyMappings,
    schemaPatches,
    schemaPatchTargets: schemaPatches.map(patch => ({
      targetSchemaId: patch.targetSchemaId,
      current: existingSchemaById.get(patch.targetSchemaId)
        ? {
            version: existingSchemaById.get(patch.targetSchemaId)!.version,
            fields: existingSchemaById.get(patch.targetSchemaId)!.fields
          }
        : null
    })),
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
    relationSchemas: mappedRelationSchemas,
    fieldGroups: mappedFieldGroups,
    capabilityConfigurations: mappedCapabilityConfigurations,
    dependencyMappings,
    schemaPatches,
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
  dependencyMappings: plan.dependencyMappings,
  schemaPatches: plan.schemaPatches,
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
  dashboardWidgets: source.dashboardWidgets,
  dependencies: source.dependencies
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
    dependencyMappings: DefinitionImportDependencyMapping[];
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
        await buildPlan(
          db,
          ws,
          input.source,
          input.selection,
          input.renames,
          input.dependencyMappings ?? [],
          event
        )
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
      const plan = await buildPlan(
        db,
        ws,
        input.source,
        input.selection,
        input.renames,
        input.dependencyMappings ?? [],
        event
      );
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
          dependencyMappings: input.dependencyMappings ?? [],
          schemaPatches: input.schemaPatches ?? [],
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
            dependencyMappings: expected.dependencyMappings,
            schemaPatches: expected.schemaPatches,
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
      const remapSchemaField = (field: SchemaField): SchemaField => {
        const groupId =
          field.groupId && sharedFieldGroupMap.has(field.groupId)
            ? sharedFieldGroupMap.get(field.groupId)!
            : field.groupId;
        const group = groupId === undefined ? {} : { groupId };
        if (isReferenceOrContainmentField(field)) {
          return {
            ...field,
            ...group,
            schemaId: schemaIdMap.get(field.schemaId) ?? field.schemaId
          };
        }
        if (field.type === 'typedRelation') {
          return {
            ...field,
            ...group,
            relationSchemaId:
              relationSchemaIdMap.get(field.relationSchemaId) ?? field.relationSchemaId
          };
        }
        if (field.type === 'select') {
          return { ...field, ...group, enumId: enumIdMap.get(field.enumId) ?? field.enumId };
        }
        if (field.type === 'derived' && field.enumId !== undefined) {
          return { ...field, ...group, enumId: enumIdMap.get(field.enumId) ?? field.enumId };
        }
        return { ...field, ...group };
      };
      const remapRelationField = (field: RelationField): RelationField => {
        const groupId =
          field.groupId && sharedFieldGroupMap.has(field.groupId)
            ? sharedFieldGroupMap.get(field.groupId)!
            : field.groupId;
        const group = groupId === undefined ? {} : { groupId };
        if (isEntityRelationField(field)) {
          return {
            ...field,
            ...group,
            schemaId: schemaIdMap.get(field.schemaId) ?? field.schemaId
          };
        }
        if (field.type === 'select') {
          return { ...field, ...group, enumId: enumIdMap.get(field.enumId) ?? field.enumId };
        }
        if (field.type === 'derived' && field.enumId !== undefined) {
          return { ...field, ...group, enumId: enumIdMap.get(field.enumId) ?? field.enumId };
        }
        return { ...field, ...group };
      };
      const now = new Date();
      await db.core.transaction(async tx => {
        const categoryIdCache = new Map<string, string>();
        const resolveCategoryId = async (rawName: string | null): Promise<string | null> => {
          if (!rawName) return null;
          const key = rawName.toLowerCase();
          const cached = categoryIdCache.get(key);
          if (cached) return cached;
          const existing = await tx.catalog.getCategoryByName(ws, rawName);
          if (existing) {
            categoryIdCache.set(key, existing.id);
            return existing.id;
          }
          const created = await tx.catalog.createCategory({
            id: randomUUID(),
            workspace: ws,
            name: rawName,
            created_at: now,
            updated_at: now
          });
          categoryIdCache.set(key, created.id);
          return created.id;
        };
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
            fields: group.fields.map(remapSchemaField),
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
          const fields = schema.fields.map(remapSchemaField);
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
            category_id: await resolveCategoryId(schema.category),
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
            category: schema.category,
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
          const fields = relationSchema.fields.map(remapRelationField);
          const groups = relationSchema.groups.map(group => ({
            ...group,
            id: sharedFieldGroupMap.get(group.id) ?? group.id,
            accessControl: group.accessControl
              ? {
                  teamIds: group.accessControl.teamIds.map(id => teamIdMap.get(id) ?? id)
                }
              : undefined
          }));
          assertResolvedFieldGroupReferences(fields, groups);
          validateDerivedFieldGroupAccess(fields, groups, 'relation');

          const row: RelationSchemaDbCreate = {
            id: relationSchemaIdMap.get(relationSchema.id)!,
            workspace: ws,
            name: relationSchema.name,
            category_id: await resolveCategoryId(relationSchema.category),
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
            category: relationSchema.category,
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

        const patchesByTarget = new Map<string, PlannedSchemaPatch[]>();
        for (const patch of plan.schemaPatches) {
          const targetSchemaId = schemaIdMap.get(patch.targetSchemaId) ?? patch.targetSchemaId;
          const patches = patchesByTarget.get(targetSchemaId) ?? [];
          patches.push(patch);
          patchesByTarget.set(targetSchemaId, patches);
        }
        for (const [targetSchemaId, patches] of patchesByTarget) {
          const current = await tx.catalog.getSchema(ws, targetSchemaId);
          httpAssert.present(current, {
            status: 409,
            message: `Schema patch target '${targetSchemaId}' no longer exists`
          });
          const fields = [
            ...current.fields,
            ...patches.flatMap(patch => patch.fields.map(remapSchemaField))
          ];
          const groups = current.groups ?? [];
          assertResolvedFieldGroupReferences(fields, groups);
          validateDerivedFieldGroupAccess(fields, groups);
          const updated = await tx.catalog.updateSchema(ws, targetSchemaId, {
            name: current.name,
            category_id: current.category_id,
            description: current.description,
            fields,
            templates: current.templates ?? [],
            groups,
            shared_field_group_links: current.shared_field_group_links ?? [],
            validation_rules: current.validation_rules ?? [],
            detail_layout: current.detail_layout,
            color: current.color,
            icon: current.icon,
            default_owner: current.default_owner,
            key_prefix: current.key_prefix,
            version: (current.version ?? 1) + 1,
            updated_at: now
          });
          httpAssert.present(updated, {
            status: 409,
            message: `Schema patch target '${targetSchemaId}' could not be updated`
          });
          const patchCategoryName = updated.category_id
            ? ((await tx.catalog.getCategory(ws, updated.category_id))?.name ?? null)
            : null;
          await tx.catalog.createSchemaVersion({
            id: randomUUID(),
            workspace: ws,
            schema_id: updated.id,
            version: updated.version ?? 1,
            name: updated.name,
            category: patchCategoryName,
            description: updated.description,
            fields: updated.fields,
            templates: updated.templates ?? [],
            groups: updated.groups ?? [],
            shared_field_group_links: updated.shared_field_group_links ?? [],
            validation_rules: updated.validation_rules ?? [],
            color: updated.color,
            icon: updated.icon,
            change_summary: buildFieldChangeSummary(
              toSchemaFieldMigrationFields(current.fields),
              toSchemaFieldMigrationFields(updated.fields)
            ),
            created_by: authCtx.userId,
            created_at: now
          });
          await writeAudit(tx, {
            userId: authCtx.userId,
            workspace: ws,
            operation: 'update',
            entityType: 'entity_schema',
            entityId: updated.id,
            entityName: updated.name,
            changes: {
              old: { fields: current.fields, version: current.version ?? 1 },
              new: { fields: updated.fields, version: updated.version ?? 1 }
            },
            metadata: { importedFrom: input.source, schemaPatch: true }
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
        dashboardWidgets: plan.dashboardWidgets.length,
        updatedSchemas: new Set(plan.schemaPatches.map(patch => patch.targetSchemaId)).size
      };
    }
  });
