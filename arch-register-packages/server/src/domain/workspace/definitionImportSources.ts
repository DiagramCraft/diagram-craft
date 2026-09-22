import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { buildApiAuthCtx, requireWorkspaceAdmin } from '../auth/authorization';
import { PermissionChecker } from '@arch-register/permissions';
import { httpAssert } from '../../utils/httpAssert';
import { resolveWorkspace } from './resolveWorkspace';
import {
  SCHEMA_TEMPLATES,
  getTemplateDependencyDescriptors,
  type SchemaTemplate,
  type SymbolicField,
  type SymbolicReference
} from '../catalog/schemaTemplates';
import { getSchemaGovernancePoliciesBySchema } from '../governance/schemaGovernancePolicy';
import type { SchemaField, SharedFieldGroupLink } from '@arch-register/api-types/schemaContract';
import type { RelationField } from '@arch-register/api-types/relationSchemaContract';
import type { DefinitionImportSource } from '@arch-register/api-types/workspaceContract';
import {
  entityDrawerConfigurationSchema,
  remapEntityDrawerProfiles
} from '@arch-register/api-types/entityDrawerConfiguration';
import type {
  DefinitionSource,
  ImportableFieldGroup,
  ImportableRelationSchema,
  ImportableSchema
} from './definitionImportTypes';
import type { TemplateDependencyKind } from '../catalog/schemaTemplates';

const checker = new PermissionChecker();
const dependencyReferencePrefix = '__template_dependency__:';
const dependencyReference = (id: string) => `${dependencyReferencePrefix}${id}`;

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
    return { ...field, enumId: symbolicReferenceId(field.enumId, ownerId, rootTemplateId) };
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
  return { id: field.id, name: field.name, type: field.type, ...requirement };
};

export const sourceFromBuiltin = (template: SchemaTemplate): DefinitionSource => {
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
      groups: schema.groups ?? [],
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
      relation_approval_policy: 'disabled' as const,
      unique_endpoint_pair: relationSchema.uniqueEndpointPair ?? false
    } satisfies ImportableRelationSchema;
  };
  const extensionSources = (template.compositionExtensions ?? []).map(extension => {
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

  return {
    kind: 'builtin',
    id: template.id,
    name: template.name,
    description: template.description,
    category: template.category,
    schemas: template.schemas.map(schema => schemaSource(schema, rootOwnerId)),
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
    relationSchemas: [
      ...(template.relationSchemas ?? []).map(relationSchema =>
        relationSchemaSource(relationSchema, rootOwnerId)
      ),
      ...extensionSources.flatMap(extension => extension.relationSchemas)
    ],
    fieldGroups: [...fieldGroupSources.values()],
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
        ) as DefinitionSource['capabilityConfigurations'][number]['bindings']
      })
    ),
    entityDrawerProfiles: remapEntityDrawerProfiles(
      template.entityDrawerProfiles ?? {},
      new Map(
        template.schemas.map(schema => [
          schema.symId,
          sourceDefinitionId(rootOwnerId, template.id, schema.symId)
        ])
      )
    ),
    dashboardWidgets: template.dashboardWidgets ?? [],
    dependencies,
    schemaPatches: extensionSources.flatMap(extension => extension.schemaPatches),
    teamNames: {}
  };
};

export const sourceFromWorkspace = async (
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
    categories,
    entityDrawerConfiguration
  ] = await Promise.all([
    db.catalog.listSchemas(workspace),
    db.catalog.listEnums(workspace),
    db.document.listDocumentTypes(workspace, true),
    db.workspace.listTeams(workspace),
    db.catalog.listSharedFieldGroups(workspace),
    getSchemaGovernancePoliciesBySchema(db, workspace),
    db.relation.listRelationSchemas(workspace),
    db.workspace.listWorkspaceCapabilityConfigurations(workspace),
    db.catalog.listCategories(workspace),
    db.workspace.getWorkspaceEntityDrawerConfiguration(workspace)
  ]);
  const teamNames = new Map(teams.map(team => [team.id, team.name]));
  const categoryNamesById = new Map(categories.map(category => [category.id, category.name]));
  const parsedEntityDrawerConfiguration = entityDrawerConfigurationSchema.safeParse(
    entityDrawerConfiguration?.configuration
  );

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
    entityDrawerProfiles: parsedEntityDrawerConfiguration.success
      ? parsedEntityDrawerConfiguration.data.profiles
      : {},
    dashboardWidgets: [],
    dependencies: [],
    schemaPatches: [],
    category: null,
    teamNames: Object.fromEntries(teamNames)
  };
};

export const loadDefinitionImportSource = async (
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
  const sourceAuthCtx = await buildApiAuthCtx(db, sourceWorkspace, event);
  requireWorkspaceAdmin(sourceAuthCtx, 'You must administer the source workspace');
  return sourceFromWorkspace(db, sourceWorkspace);
};

export const canAdministerDefinitionImportSource = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
) => {
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  return (
    checker.hasGlobalPermission(authCtx, 'admin_platform') ||
    checker.hasWorkspaceCapability(authCtx, 'people.role')
  );
};

export const toDefinitionImportSourceOption = (source: DefinitionSource) => ({
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

export { SCHEMA_TEMPLATES };
export type { TemplateDependencyKind };
