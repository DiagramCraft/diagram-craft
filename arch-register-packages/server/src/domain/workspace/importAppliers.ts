import { createHash, randomUUID } from 'node:crypto';
import type {
  DatabaseAdapter,
  ContentNodeDbUpsert,
  EntityDbCreate,
  SchemaDbCreate
} from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';

import type {
  WorkspaceAuthorizationContext,
  WorkspaceCapability
} from '@arch-register/permissions';
import { formatPublicId } from '../../utils/publicIds';
import { httpAssert } from '../../utils/httpAssert';

import { entityRequiresApproval } from '../catalog/entityChangeOperations';
import { computeEntityCompleteness } from '../../utils/completeness';
import type { DocumentField, DocumentMetadata } from '@arch-register/api-types/documentContract';
import type { GovernanceWorkflowConfig } from '@arch-register/api-types/governanceCaseConfigSchemas';
import { isReferenceOrContainmentField } from '@arch-register/api-types/schemaContract';
import type {
  ExportConfig,
  ExportSchema,
  ExportRelationSchema,
  ExportEntity,
  ExportRelation,
  ExportProject,
  ExportContentNode,
  IdMapping,
  ExportDocumentData,
  ExportSharedFieldGroup
} from './exportTypes';
import { requireNoRestrictedFieldWrites } from '../auth/fieldGroupAccessControl';
import { DOCUMENT_STATUS_CASE_KIND } from '../document/documentWorkflowOperations';
import { encodeCaseSubkind } from '../governance/governanceCaseSubkind';
import { validateRelationEndpoints } from '../catalog/relationHelpers';
import { requireTypedRelationEdit } from '../catalog/relationAccessControl';
import { listAllRelations } from '../catalog/relationOperations';
import {
  assertResolvedFieldGroupReferences,
  normalizeSchemaCategory
} from '../catalog/schemaHelpers';
import { validateDerivedFieldGroupAccess } from '../derived/derivedFields';
import { coordinateContentWrite } from '../project/contentWriteCoordinator';

type ImportResolution = { action: string; new_name?: string };

const VALID_WORKSPACE_CAPABILITIES = new Set([
  'ws.view',
  'ws.settings',
  'ws.delete',
  'ws.audit',
  'ws.manage_views',
  'ws.manage_dashboard',
  'people.invite',
  'people.role',
  'people.remove',
  'people.teams',
  'proj.create',
  'proj.edit',
  'proj.delete',
  'content.view',
  'content.edit',
  'ent.edit',
  'ent.propose',
  'ent.approve',
  'ent.override',
  'ent.external_update',
  'governance.external',
  'comments',
  'schema.edit',
  'schema.publish'
]);

const toWorkspaceCapabilities = (capabilities: string[]): WorkspaceCapability[] => {
  const parsed = capabilities.filter((capability): capability is WorkspaceCapability =>
    VALID_WORKSPACE_CAPABILITIES.has(capability)
  );
  httpAssert.true(parsed.length === capabilities.length, {
    status: 400,
    message: 'Import contains an unknown workspace capability'
  });
  return parsed;
};

const resolveMappedId = (mapping: Map<string, string>, id: string | null | undefined) => {
  if (id == null) return null;
  return mapping.get(id) ?? id;
};

const hasSkipResolution = (resolutions: Record<string, ImportResolution>, id: string) =>
  resolutions[id]?.action === 'skip';

const remapGovernanceConfigTeams = (
  config: GovernanceWorkflowConfig,
  teamMapping: Map<string, string>
): GovernanceWorkflowConfig => {
  const remapTargets = (value: GovernanceWorkflowConfig['approvals']) => {
    if (!value) return value;
    return {
      ...value,
      fallbackTeamIds: value.fallbackTeamIds.map(id => teamMapping.get(id) ?? id)
    };
  };
  return {
    ...config,
    ...(config.approvals && { approvals: remapTargets(config.approvals) }),
    ...(config.escalation && {
      escalation: {
        ...config.escalation,
        fallbackTeamIds: config.escalation.fallbackTeamIds.map(id => teamMapping.get(id) ?? id)
      }
    })
  };
};

const generateSchemaKeyPrefix = (seed: string) => {
  const bytes = createHash('sha1').update(seed).digest();
  let prefix = '';

  for (let i = 0; prefix.length < 5 && i < bytes.length; i++) {
    prefix += String.fromCharCode(65 + (bytes[i]! % 26));
  }

  return prefix.length >= 2 ? prefix : 'SCM';
};

const importSharedFieldGroups = async (
  db: DatabaseAdapter,
  workspace: string,
  sources: Array<{ shared_field_groups?: ExportSharedFieldGroup[] }>,
  preserveIds: boolean,
  idMapping: IdMapping
) => {
  const now = new Date();
  const sourceSharedGroups = new Map<string, ExportSharedFieldGroup>();
  for (const source of sources) {
    for (const group of source.shared_field_groups ?? []) {
      if (!sourceSharedGroups.has(group.id)) sourceSharedGroups.set(group.id, group);
    }
  }
  if (sourceSharedGroups.size === 0) return;

  const existingSharedGroups = await db.catalog.listSharedFieldGroups(workspace);
  const existingSharedGroupsById = new Map(existingSharedGroups.map(group => [group.id, group]));
  const existingSharedGroupsByName = new Map(
    existingSharedGroups.map(group => [group.name.toLowerCase(), group])
  );
  for (const group of sourceSharedGroups.values()) {
    const existing = preserveIds
      ? (existingSharedGroupsById.get(group.id) ??
        existingSharedGroupsByName.get(group.name.toLowerCase()))
      : existingSharedGroupsByName.get(group.name.toLowerCase());
    if (!idMapping.shared_field_groups.has(group.id)) {
      idMapping.shared_field_groups.set(
        group.id,
        existing?.id ?? (preserveIds ? group.id : randomUUID())
      );
    }
  }
  for (const group of sourceSharedGroups.values()) {
    const nextId = idMapping.shared_field_groups.get(group.id)!;
    const existing =
      existingSharedGroupsById.get(nextId) ??
      existingSharedGroupsByName.get(group.name.toLowerCase());
    const input = {
      id: nextId,
      workspace,
      name: group.name,
      description: group.description,
      fields: group.fields,
      sort_order: group.sort_order,
      created_at: existing?.created_at ?? now,
      updated_at: now
    };
    if (existing) {
      await db.catalog.updateSharedFieldGroup(workspace, existing.id, {
        name: input.name,
        description: input.description,
        fields: input.fields,
        sort_order: input.sort_order,
        updated_at: input.updated_at
      });
    } else {
      await db.catalog.createSharedFieldGroup(input);
    }
  }
};

export const importConfig = async (
  db: DatabaseAdapter,
  workspace: string,
  config: ExportConfig,
  preserveIds: boolean,
  resolutions: Record<string, ImportResolution>,
  idMapping: IdMapping
): Promise<{ lifecycle_states: number; teams: number; roles: number }> => {
  const now = new Date();
  const lifecycleStates = config.lifecycle_states.flatMap(state => {
    if (hasSkipResolution(resolutions, state.id) || resolutions[state.id]?.action === 'merge')
      return [];
    const nextId =
      idMapping.lifecycle_states.get(state.id) ?? (preserveIds ? state.id : randomUUID());
    idMapping.lifecycle_states.set(state.id, nextId);
    return [
      {
        id: nextId,
        workspace,
        label: state.label,
        color: state.color,
        sort_order: state.sort_order,
        created_at: now
      }
    ];
  });

  const teams = config.teams.flatMap(team => {
    if (hasSkipResolution(resolutions, team.id) || resolutions[team.id]?.action === 'merge')
      return [];
    const nextId = idMapping.teams.get(team.id) ?? (preserveIds ? team.id : randomUUID());
    idMapping.teams.set(team.id, nextId);
    return [
      {
        id: nextId,
        workspace,
        name: team.name,
        sort_order: team.sort_order,
        color: team.color,
        description: team.description,
        created_at: now
      }
    ];
  });

  if (lifecycleStates.length > 0) {
    await db.workspace.replaceLifecycleStates(workspace, lifecycleStates);
  }

  if (teams.length > 0) {
    await db.workspace.replaceTeams(workspace, teams);
  }

  let roleCount = 0;
  const existingRoles = await db.workspace.listCustomWorkspaceRoles(workspace);
  const existingRolesById = new Map(existingRoles.map(role => [role.id, role]));

  for (const role of config.roles) {
    if (hasSkipResolution(resolutions, role.id)) continue;

    const nextId = preserveIds ? role.id : randomUUID();
    const capabilities = toWorkspaceCapabilities(role.capabilities);
    const existing = existingRolesById.get(nextId);

    if (existing) {
      await db.workspace.updateCustomWorkspaceRole(workspace, nextId, {
        name: role.name,
        description: role.description,
        tone: role.tone,
        builtin: false,
        capabilities,
        updated_at: now
      });
    } else {
      await db.workspace.createCustomWorkspaceRole({
        id: nextId,
        workspace,
        name: role.name,
        description: role.description,
        tone: role.tone,
        builtin: false,
        capabilities,
        created_at: now,
        updated_at: now
      });
    }
    roleCount++;
  }

  return { lifecycle_states: lifecycleStates.length, teams: teams.length, roles: roleCount };
};

export const importSchemas = async (
  db: DatabaseAdapter,
  workspace: string,
  schemas: ExportSchema[],
  preserveIds: boolean,
  resolutions: Record<string, ImportResolution>,
  idMapping: IdMapping
): Promise<{ created: number; updated: number }> => {
  const now = new Date();
  await importSharedFieldGroups(db, workspace, schemas, preserveIds, idMapping);
  const existingSchemas = await db.catalog.listSchemas(workspace);
  const existingSchemasById = new Map(existingSchemas.map(schema => [schema.id, schema]));
  const existingSchemasByName = new Map(
    existingSchemas.map(schema => [schema.name.toLowerCase(), schema])
  );

  for (const schema of schemas) {
    if (hasSkipResolution(resolutions, schema.id)) continue;
    if (resolutions[schema.id]?.action === 'merge') continue;
    if (idMapping.schemas.has(schema.id)) continue;
    const existing = preserveIds
      ? (existingSchemasById.get(schema.id) ?? existingSchemasByName.get(schema.name.toLowerCase()))
      : (existingSchemasByName.get(schema.name.toLowerCase()) ??
        existingSchemasById.get(schema.id));
    const nextId = existing?.id ?? (preserveIds ? schema.id : randomUUID());
    idMapping.schemas.set(schema.id, nextId);
  }

  const mappedSchemas = schemas.flatMap(schema => {
    if (hasSkipResolution(resolutions, schema.id)) return [];
    const nextId = idMapping.schemas.get(schema.id) ?? schema.id;
    return [{ schema, nextId }];
  });

  let created = 0;
  let updated = 0;

  for (const { schema, nextId } of mappedSchemas) {
    const existing =
      existingSchemasById.get(nextId) ?? existingSchemasByName.get(schema.name.toLowerCase());
    const fields = schema.fields.map(field => {
      const withGroup =
        field.groupId && idMapping.shared_field_groups.has(field.groupId)
          ? { ...field, groupId: idMapping.shared_field_groups.get(field.groupId) }
          : field;
      if (isReferenceOrContainmentField(withGroup)) {
        return {
          ...withGroup,
          schemaId: resolveMappedId(idMapping.schemas, withGroup.schemaId) ?? withGroup.schemaId
        };
      }
      return withGroup;
    });
    const fieldById = new Map(fields.map(field => [field.id, field]));
    const templates = (schema.templates ?? []).map(template => {
      const templateFields: typeof template.values.fields = {};
      for (const [fieldId, value] of Object.entries(template.values.fields)) {
        const field = fieldById.get(fieldId);
        if (field !== undefined && isReferenceOrContainmentField(field)) {
          const remapped =
            Array.isArray(value) && value.every((item): item is string => typeof item === 'string')
              ? value.flatMap(id => idMapping.entities.get(id) ?? [])
              : [];
          if (remapped.length > 0) templateFields[fieldId] = remapped;
        } else {
          templateFields[fieldId] = value;
        }
      }
      const owner = template.values.owner ? idMapping.teams.get(template.values.owner) : undefined;
      const lifecycle = template.values.lifecycle
        ? idMapping.lifecycle_states.get(template.values.lifecycle)
        : undefined;
      return {
        ...template,
        values: { ...template.values, fields: templateFields, owner, lifecycle }
      };
    });

    const input: SchemaDbCreate = {
      id: nextId,
      workspace,
      name: schema.name,
      category:
        schema.category !== undefined
          ? normalizeSchemaCategory(schema.category)
          : (existing?.category ?? null),
      description: existing?.description ?? '',
      fields,
      ...(schema.entity_capabilities !== undefined && {
        entity_capabilities: schema.entity_capabilities
      }),
      groups: (schema.groups ?? []).map(group => ({
        ...group,
        id: idMapping.shared_field_groups.get(group.id) ?? group.id,
        accessControl: group.accessControl
          ? { teamIds: group.accessControl.teamIds.map(id => idMapping.teams.get(id) ?? id) }
          : undefined
      })),
      shared_field_group_links: (schema.shared_field_group_links ?? []).map(link => ({
        ...link,
        groupId: idMapping.shared_field_groups.get(link.groupId) ?? link.groupId,
        teamIds: link.teamIds?.map(id => idMapping.teams.get(id) ?? id)
      })),
      templates,
      color: schema.color,
      icon: schema.icon,
      default_owner: resolveMappedId(idMapping.teams, schema.default_owner),
      key_prefix: existing?.key_prefix ?? generateSchemaKeyPrefix(nextId),
      created_at: existing?.created_at ?? now,
      updated_at: now
    };

    assertResolvedFieldGroupReferences(input.fields, input.groups ?? []);
    validateDerivedFieldGroupAccess(input.fields, input.groups ?? []);

    if (existing) {
      const previousKeyPrefix = existing.key_prefix;
      const row = await db.catalog.updateSchema(workspace, nextId, {
        name: input.name,
        category: input.category,
        description: input.description,
        fields: input.fields,
        ...(input.entity_capabilities !== undefined && {
          entity_capabilities: input.entity_capabilities
        }),
        templates: input.templates,
        groups: input.groups,
        shared_field_group_links: input.shared_field_group_links,
        color: input.color,
        icon: input.icon,
        default_owner: input.default_owner,
        key_prefix: input.key_prefix,
        updated_at: now
      });
      if (row?.key_prefix && row.key_prefix !== previousKeyPrefix) {
        if (previousKeyPrefix) {
          await db.workspace.updatePublicIdPrefix(
            previousKeyPrefix,
            row.key_prefix,
            'schema',
            row.id,
            now
          );
        } else {
          await db.workspace.registerPublicIdPrefix(row.key_prefix, 'schema', row.id, now);
        }
      } else if (previousKeyPrefix && !row?.key_prefix) {
        await db.workspace.deletePublicIdPrefix(previousKeyPrefix);
      }
      updated++;
    } else {
      await db.catalog.createSchema(input);
      if (input.key_prefix) {
        await db.workspace.registerPublicIdPrefix(input.key_prefix, 'schema', nextId, now);
      }
      created++;
    }
    for (const config of schema.governance_configs ?? []) {
      await db.governanceCaseConfig.upsertCaseConfig({
        workspace,
        case_kind: config.case_kind,
        case_subkind: encodeCaseSubkind(nextId),
        enabled: config.enabled,
        config: remapGovernanceConfigTeams(config.config, idMapping.teams),
        updated_at: now,
        updated_by: null
      });
    }
  }

  return { created, updated };
};

export const importRelationSchemas = async (
  db: DatabaseAdapter,
  workspace: string,
  relationSchemas: ExportRelationSchema[],
  preserveIds: boolean,
  resolutions: Record<string, ImportResolution>,
  idMapping: IdMapping
): Promise<{ created: number; updated: number }> => {
  const now = new Date();
  await importSharedFieldGroups(db, workspace, relationSchemas, preserveIds, idMapping);
  const existingSchemas = await db.relation.listRelationSchemas(workspace);
  const existingById = new Map(existingSchemas.map(schema => [schema.id, schema]));
  const existingByName = new Map(
    existingSchemas.map(schema => [schema.name.toLowerCase(), schema])
  );
  let created = 0;
  let updated = 0;

  for (const source of relationSchemas) {
    if (hasSkipResolution(resolutions, source.id)) continue;
    if (resolutions[source.id]?.action === 'merge') continue;

    const existing =
      existingById.get(idMapping.relation_schemas.get(source.id) ?? source.id) ??
      existingByName.get(source.name.toLowerCase());
    const nextId =
      idMapping.relation_schemas.get(source.id) ??
      existing?.id ??
      (preserveIds ? source.id : randomUUID());
    idMapping.relation_schemas.set(source.id, nextId);
    if (source.relation_approval_policy === 'required') {
      throw new Error(
        `Relation schema '${source.name}' uses unsupported approval policy 'required'; relation approval workflow is provided by #2574`
      );
    }

    const fields = source.fields.map(field => {
      const withGroup =
        field.groupId && idMapping.shared_field_groups.has(field.groupId)
          ? { ...field, groupId: idMapping.shared_field_groups.get(field.groupId) }
          : field;
      if (withGroup.type !== 'entityRelation') return withGroup;
      return {
        ...withGroup,
        schemaId: resolveMappedId(idMapping.schemas, withGroup.schemaId) ?? withGroup.schemaId
      };
    });
    const input = {
      id: nextId,
      workspace,
      name: source.name,
      category:
        source.category !== undefined
          ? normalizeSchemaCategory(source.category)
          : (existing?.category ?? null),
      description: source.description,
      in_schema_ids:
        source.in_schema_ids === 'any'
          ? ('any' as const)
          : source.in_schema_ids.map(id => resolveMappedId(idMapping.schemas, id)!),
      out_schema_ids:
        source.out_schema_ids === 'any'
          ? ('any' as const)
          : source.out_schema_ids.map(id => resolveMappedId(idMapping.schemas, id)!),
      fields,
      groups: (source.groups ?? []).map(group => ({
        ...group,
        id: idMapping.shared_field_groups.get(group.id) ?? group.id,
        accessControl: group.accessControl
          ? { teamIds: group.accessControl.teamIds.map(id => idMapping.teams.get(id) ?? id) }
          : undefined
      })),
      shared_field_group_links: (source.shared_field_group_links ?? []).map(link => ({
        ...link,
        groupId: idMapping.shared_field_groups.get(link.groupId) ?? link.groupId,
        teamIds: link.teamIds?.map(id => idMapping.teams.get(id) ?? id)
      })),
      color: source.color,
      icon: source.icon,
      relation_approval_policy: 'disabled' as const,
      version: source.version ?? 1,
      created_at: existing?.created_at ?? now,
      updated_at: now
    };

    assertResolvedFieldGroupReferences(input.fields, input.groups);

    if (existing) {
      await db.relation.updateRelationSchema(workspace, nextId, {
        name: input.name,
        category: input.category,
        description: input.description,
        in_schema_ids: input.in_schema_ids,
        out_schema_ids: input.out_schema_ids,
        fields: input.fields,
        groups: input.groups,
        shared_field_group_links: input.shared_field_group_links,
        color: input.color,
        icon: input.icon,
        relation_approval_policy: input.relation_approval_policy,
        version: input.version,
        updated_at: input.updated_at
      });
      updated++;
    } else {
      await db.relation.createRelationSchema(input);
      created++;
    }
  }

  return { created, updated };
};

export const importEntities = async (
  db: DatabaseAdapter,
  authCtx: WorkspaceAuthorizationContext,
  workspace: string,
  entities: ExportEntity[],
  preserveIds: boolean,
  resolutions: Record<string, ImportResolution>,
  idMapping: IdMapping
): Promise<{ created: number; updated: number; skipped: number }> => {
  const now = new Date();
  const existingEntities = new Map(
    (await db.catalog.listEntities(workspace)).map(entity => [entity.id, entity])
  );
  const usedPublicIds = new Set(
    [...existingEntities.values()]
      .map(entity => entity.public_id)
      .filter((publicId): publicId is string => publicId != null)
  );
  const mappedEntities = entities.flatMap(entity => {
    if (hasSkipResolution(resolutions, entity.id) || resolutions[entity.id]?.action === 'merge')
      return [];
    const nextId = idMapping.entities.get(entity.id) ?? (preserveIds ? entity.id : randomUUID());
    idMapping.entities.set(entity.id, nextId);
    return [{ entity, nextId }];
  });

  let created = 0;
  let updated = 0;
  const skipped = 0;
  const schemasById = new Map<
    string,
    NonNullable<Awaited<ReturnType<typeof db.catalog.getSchema>>>
  >();

  for (const { entity, nextId } of mappedEntities) {
    const existing = existingEntities.get(nextId);
    const schemaId = resolveMappedId(idMapping.schemas, entity.schema_id) ?? entity.schema_id;
    const schema = await db.catalog.getSchema(workspace, schemaId);
    httpAssert.present(schema, {
      status: 409,
      message: `Schema '${schemaId}' is unavailable while importing entity '${entity.id}'`
    });
    schemasById.set(schema.id, schema);
    requireNoRestrictedFieldWrites(
      authCtx,
      schema,
      Object.keys(entity.data),
      'You do not have permission to import one or more restricted fields on this entity'
    );
    if (!existing) continue;
    if (schema && (await entityRequiresApproval(db, workspace, schema, existing))) {
      throw new Error(
        `Entity ${existing.id} requires an approved change proposal before it can be imported`
      );
    }
  }

  for (const { entity, nextId } of mappedEntities) {
    const existing = existingEntities.get(nextId);
    const schemaId = resolveMappedId(idMapping.schemas, entity.schema_id) ?? entity.schema_id;
    const schema = schemasById.get(schemaId)!;
    let publicId = preserveIds ? (entity.public_id ?? nextId) : null;
    if (!publicId || usedPublicIds.has(publicId)) {
      do {
        publicId = formatPublicId(
          schema.key_prefix,
          await db.workspace.allocatePublicId(schema.key_prefix, now)
        );
      } while (usedPublicIds.has(publicId));
    }
    usedPublicIds.add(publicId);
    const mappedOwner = entity.owner == null ? null : (idMapping.teams.get(entity.owner) ?? null);
    const mappedLifecycle =
      entity.lifecycle == null ? null : (idMapping.lifecycle_states.get(entity.lifecycle) ?? null);
    const completeness = schema
      ? computeEntityCompleteness(
          {
            description: entity.description,
            owner: mappedOwner,
            lifecycle: mappedLifecycle,
            data: entity.data
          },
          schema
        )
      : 0;
    const input: EntityDbCreate = {
      id: nextId,
      workspace,
      public_id: publicId,
      schema_id: schemaId,
      name: entity.name,
      slug: entity.slug,
      namespace: entity.namespace,
      description: entity.description,
      owner: mappedOwner,
      lifecycle: mappedLifecycle,
      target_lifecycle:
        entity.target_lifecycle == null
          ? null
          : (idMapping.lifecycle_states.get(entity.target_lifecycle) ?? null),
      target_lifecycle_date: entity.target_lifecycle_date,
      tags: entity.tags,
      links: entity.links,
      data: entity.data,
      project_id: entity.project_id,
      created_at: existing?.created_at ?? now,
      updated_at: now,
      completeness
    };

    if (existing) {
      await db.catalog.updateEntity(workspace, nextId, {
        name: input.name,
        slug: input.slug,
        namespace: input.namespace,
        description: input.description,
        schema_id: input.schema_id,
        owner: input.owner,
        lifecycle: input.lifecycle,
        target_lifecycle: input.target_lifecycle,
        target_lifecycle_date: input.target_lifecycle_date,
        tags: input.tags,
        links: input.links,
        data: input.data,
        project_id: input.project_id,
        updated_at: now,
        completeness: input.completeness
      });
      updated++;
    } else {
      await db.catalog.createEntity(input);
      created++;
    }
  }

  return { created, updated, skipped };
};

const relationIdentity = (schemaId: string, inEntityId: string, outEntityId: string) =>
  `${schemaId}\u0000${inEntityId}\u0000${outEntityId}`;

type RelationIdentityRecord = {
  id: string;
  schema_id: string;
  in_entity_id: string;
  out_entity_id: string;
};

export const importRelations = async (
  db: DatabaseAdapter,
  authCtx: WorkspaceAuthorizationContext,
  workspace: string,
  relations: ExportRelation[],
  preserveIds: boolean,
  resolutions: Record<string, ImportResolution>,
  idMapping: IdMapping
): Promise<{ created: number; updated: number; skipped: number }> => {
  const now = new Date();
  const existingRelations = await listAllRelations(db, workspace, {});
  const existingById = new Map<string, RelationIdentityRecord>(
    existingRelations.map(relation => [relation.id, relation])
  );
  const existingByIdentity = new Map<string, RelationIdentityRecord>(
    existingRelations.map(relation => [
      relationIdentity(relation.schema_id, relation.in_entity_id, relation.out_entity_id),
      relation
    ])
  );
  const mappedRelations = relations.flatMap(relation => {
    if (
      hasSkipResolution(resolutions, relation.id) ||
      resolutions[relation.id]?.action === 'merge'
    ) {
      return [];
    }
    const nextId =
      idMapping.relations.get(relation.id) ?? (preserveIds ? relation.id : randomUUID());
    idMapping.relations.set(relation.id, nextId);
    return [{ relation, nextId }];
  });

  let created = 0;
  let updated = 0;
  const skipped = relations.length - mappedRelations.length;

  for (const { relation, nextId } of mappedRelations) {
    const schemaId = resolveMappedId(idMapping.relation_schemas, relation.schema_id);
    const schema = await db.relation.getRelationSchema(workspace, schemaId!);
    httpAssert.present(schema, {
      status: 409,
      message: `Relation schema '${relation.schema_id}' is unavailable while importing relation '${relation.id}'`
    });
    httpAssert.true(schema.relation_approval_policy !== 'required', {
      status: 400,
      message: `Relation schema '${schema.name}' uses unsupported approval policy 'required'; relation approval workflow is provided by #2574`
    });
    httpAssert.true(relation.approval_policy_override !== 'required', {
      status: 400,
      message: `Relation '${relation.id}' uses unsupported approval policy override 'required'; relation approval workflow is provided by #2574`
    });

    const [inEntity, outEntity] = await Promise.all([
      db.catalog.getEntity(workspace, resolveMappedId(idMapping.entities, relation.in_entity_id)!),
      db.catalog.getEntity(workspace, resolveMappedId(idMapping.entities, relation.out_entity_id)!)
    ]);
    validateRelationEndpoints(schema, inEntity, outEntity);
    const [inSchema, outSchema] = await Promise.all([
      db.catalog.getSchema(workspace, inEntity!.schema_id),
      db.catalog.getSchema(workspace, outEntity!.schema_id)
    ]);
    requireTypedRelationEdit(
      authCtx,
      [
        { schema: inSchema, direction: 'in' },
        { schema: outSchema, direction: 'out' }
      ],
      schema.id
    );
    requireNoRestrictedFieldWrites(
      authCtx,
      schema,
      Object.keys(relation.data),
      'You do not have permission to import one or more restricted relation fields'
    );

    const mappedInEntityId = inEntity!.id;
    const mappedOutEntityId = outEntity!.id;
    const existing =
      existingById.get(nextId) ??
      existingByIdentity.get(relationIdentity(schema.id, mappedInEntityId, mappedOutEntityId));
    if (existing && existing.id !== nextId) idMapping.relations.set(relation.id, existing.id);
    const createdAt = new Date(relation.created_at);
    const updatedAt = new Date(relation.updated_at);
    const input = {
      id: nextId,
      workspace,
      schema_id: schema.id,
      in_entity_id: mappedInEntityId,
      out_entity_id: mappedOutEntityId,
      data: relation.data,
      version: relation.version,
      approval_policy_override: relation.approval_policy_override,
      created_at: Number.isNaN(createdAt.getTime()) ? now : createdAt,
      updated_at: Number.isNaN(updatedAt.getTime()) ? now : updatedAt
    };

    if (existing) {
      if (
        existing.schema_id !== input.schema_id ||
        existing.in_entity_id !== input.in_entity_id ||
        existing.out_entity_id !== input.out_entity_id
      ) {
        await db.relation.deleteRelation(workspace, existing.id);
        await db.relation.createRelation(input);
      } else {
        await db.relation.updateRelation(workspace, existing.id, {
          data: input.data,
          version: input.version,
          approval_policy_override: input.approval_policy_override,
          updated_at: input.updated_at
        });
      }
      updated++;
    } else {
      await db.relation.createRelation(input);
      created++;
    }
    const stored: RelationIdentityRecord = {
      id: existing?.id ?? input.id,
      schema_id: input.schema_id,
      in_entity_id: input.in_entity_id,
      out_entity_id: input.out_entity_id
    };
    existingById.set(stored.id, stored);
    existingByIdentity.set(
      relationIdentity(stored.schema_id, stored.in_entity_id, stored.out_entity_id),
      stored
    );
  }

  return { created, updated, skipped };
};

export const importProjects = async (
  db: DatabaseAdapter,
  workspace: string,
  projects: ExportProject[],
  preserveIds: boolean,
  resolutions: Record<string, ImportResolution>,
  idMapping: IdMapping
): Promise<{ created: number; updated: number }> => {
  const now = new Date();
  const workspaceRow = await db.workspace.getWorkspace(workspace);
  httpAssert.present(workspaceRow, { status: 404, message: `Workspace '${workspace}' not found` });
  const existingProjects = new Map(
    (await db.project.listProjects(workspace)).map(project => [project.id, project])
  );
  const mappedProjects = projects.flatMap(project => {
    if (hasSkipResolution(resolutions, project.id) || resolutions[project.id]?.action === 'merge')
      return [];
    const nextId = idMapping.projects.get(project.id) ?? (preserveIds ? project.id : randomUUID());
    idMapping.projects.set(project.id, nextId);
    return [{ project, nextId }];
  });

  let created = 0;
  let updated = 0;

  for (const { project, nextId } of mappedProjects) {
    const existing = existingProjects.get(nextId);
    const status = project.status === 'archived' ? 'cancelled' : 'active';
    const pinned = project.status === 'pinned';
    const owner = resolveMappedId(idMapping.teams, project.owner);

    if (existing) {
      await db.project.updateProject(workspace, nextId, {
        name: project.name,
        description: project.description,
        owner,
        status,
        color: project.color,
        start_date: null,
        target_date: null,
        pinned,
        updated_at: now
      });
      updated++;
    } else {
      await db.project.createProject({
        id: nextId,
        workspace,
        public_id: formatPublicId(
          workspaceRow.short_code,
          await db.workspace.allocatePublicId(workspaceRow.short_code, now)
        ),
        name: project.name,
        description: project.description,
        owner,
        status,
        color: project.color,
        start_date: null,
        target_date: null,
        pinned,
        created_at: now,
        updated_at: now
      });
      created++;
    }
  }

  return { created, updated };
};

const storageScope = (
  workspace: string,
  node: { project_id: string | null; entity_id: string | null }
) => node.project_id ?? node.entity_id ?? workspace;

export const importContentNodes = async (
  db: DatabaseAdapter,
  storage: StorageAdapter | undefined,
  authCtx: WorkspaceAuthorizationContext,
  workspace: string,
  contentNodes: ExportContentNode[],
  preserveIds: boolean,
  resolutions: Record<string, ImportResolution>,
  idMapping: IdMapping,
  contentFiles?: Map<string, Buffer>
): Promise<{ created: number; updated: number }> => {
  const now = new Date();
  const existingNodes = new Map(
    (await db.project.listAllContentNodes(workspace)).map(node => [node.id, node])
  );
  const mappedNodes = contentNodes.flatMap(node => {
    if (hasSkipResolution(resolutions, node.id) || resolutions[node.id]?.action === 'merge')
      return [];
    const nextId = idMapping.content_nodes.get(node.id) ?? (preserveIds ? node.id : randomUUID());
    idMapping.content_nodes.set(node.id, nextId);
    return [{ node, nextId }];
  });

  mappedNodes.sort((a, b) => {
    const depthA = a.node.path.split('/').length;
    const depthB = b.node.path.split('/').length;
    return depthA - depthB || a.node.path.localeCompare(b.node.path);
  });

  let created = 0;
  let updated = 0;

  for (const { node, nextId } of mappedNodes) {
    const existing = existingNodes.get(nextId);
    const projectId = resolveMappedId(idMapping.projects, node.project_id);
    const entityId = resolveMappedId(idMapping.entities, node.entity_id);
    const parentId = resolveMappedId(idMapping.content_nodes, node.parent_id);
    const storageProjectId = storageScope(workspace, {
      project_id: projectId,
      entity_id: entityId
    });

    const content =
      node.content_file && contentFiles?.has(node.content_file)
        ? contentFiles.get(node.content_file)!
        : undefined;
    const previewBuffer = node.preview_file ? contentFiles?.get(node.preview_file) : undefined;
    const previewSvg = previewBuffer ? previewBuffer.toString('utf8') : null;
    let row!: Awaited<ReturnType<DatabaseAdapter['project']['upsertContentNode']>>;
    await coordinateContentWrite({
      db,
      storage,
      operation: 'workspace-import-content-node',
      scope: projectId ? 'project' : entityId ? 'entity' : 'workspace',
      nodeIds: [nextId],
      storageChanges:
        content && storage
          ? [
              {
                type: 'write' as const,
                workspace,
                storageId: storageProjectId,
                nodeId: nextId,
                content
              }
            ]
          : undefined,
      writeDatabase: async tx => {
        row = await tx.project.upsertContentNode({
          id: nextId,
          workspace,
          project_id: projectId,
          entity_id: entityId,
          parent_id: parentId,
          path: node.path,
          name: node.name,
          type: node.type,
          size_bytes: node.size_bytes,
          comment_count: 0,
          unresolved_comment_count: 0,
          created_atIfNew: now,
          updated_at: now,
          created_byIfNew: null,
          updated_by: authCtx.userId
        } satisfies ContentNodeDbUpsert);
        if (node.type !== 'folder') {
          if (projectId) {
            await tx.project.updateContentNodeDerivedData(
              workspace,
              storageProjectId,
              row.id,
              node.size_bytes,
              0,
              0,
              previewSvg,
              now
            );
            await tx.project.updateContentNodeTemplateStatus(
              workspace,
              storageProjectId,
              row.id,
              node.is_template,
              node.is_workspace_template,
              now
            );
          } else if (entityId) {
            await tx.project.updateContentNodeDerivedData(
              workspace,
              storageProjectId,
              row.id,
              node.size_bytes,
              0,
              0,
              previewSvg,
              now
            );
          } else {
            await tx.project.updateWorkspaceContentNodeDerivedData(
              workspace,
              row.id,
              node.size_bytes,
              0,
              0,
              previewSvg,
              now
            );
          }
        }
      }
    });

    if (existing) {
      updated++;
    } else {
      created++;
    }
  }

  return { created, updated };
};

const remapDocumentMetadataValues = (
  fields: DocumentField[],
  sourceValues: DocumentMetadata,
  resolveEntity: (id: string) => string | undefined,
  resolveDocument: (id: string) => string | undefined
) => {
  const values = { ...sourceValues };
  for (const field of fields) {
    if (field.type !== 'entity_link' && field.type !== 'document_link') continue;
    const raw = values[field.id];
    if (raw === undefined) continue;
    const sourceIds = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
    const mapped = sourceIds
      .map(id => (field.type === 'entity_link' ? resolveEntity(id) : resolveDocument(id)))
      .filter((id): id is string => !!id);
    values[field.id] = Array.isArray(raw) ? mapped : (mapped[0] ?? null);
  }
  return values;
};

export const importDocuments = async (
  db: DatabaseAdapter,
  workspace: string,
  documents: ExportDocumentData,
  preserveIds: boolean,
  resolutions: Record<string, ImportResolution>,
  idMapping: IdMapping,
  sourceEntities?: ExportEntity[]
): Promise<{ created: number; templates: number; metadata: number; revisions: number }> => {
  const typeMapping = new Map<string, string>();
  const sourceEntityIdByIdentifier = new Map<string, string>();
  for (const entity of sourceEntities ?? []) {
    sourceEntityIdByIdentifier.set(entity.id, entity.id);
    if (entity.public_id) sourceEntityIdByIdentifier.set(entity.public_id, entity.id);
  }
  const existingTypes = await db.document.listDocumentTypes(workspace, true);
  let created = 0;
  for (const type of documents.types) {
    if (hasSkipResolution(resolutions, type.id)) continue;
    const resolution = resolutions[type.id];
    const existing = existingTypes.find(
      candidate =>
        candidate.id === type.id || candidate.name.toLowerCase() === type.name.toLowerCase()
    );
    const reuseExisting = existing != null && resolution?.action !== 'rename';
    const nextId = reuseExisting ? existing.id : preserveIds && !existing ? type.id : randomUUID();
    typeMapping.set(type.id, nextId);
    const now = new Date();
    const input = {
      name: type.name,
      description: type.description,
      fields: type.fields,
      aiActions: type.aiActions ?? [],
      color: type.color,
      icon: type.icon,
      updated_at: now
    };
    if (reuseExisting) {
      await db.document.updateDocumentType(workspace, nextId, input);
      await db.document.archiveDocumentType(workspace, nextId, type.archived, now);
    } else {
      await db.document.createDocumentType({
        id: nextId,
        workspace,
        ...input,
        created_at: new Date(type.created_at)
      });
      if (type.archived) await db.document.archiveDocumentType(workspace, nextId, true, now);
      created++;
    }
  }
  for (const config of documents.workflow_configs ?? []) {
    const [sourceDocumentTypeId, fieldId] = config.case_subkind.split(':');
    const documentTypeId = typeMapping.get(sourceDocumentTypeId ?? '');
    if (!documentTypeId || !fieldId) continue;
    await db.governanceCaseConfig.upsertCaseConfig({
      workspace,
      case_kind: config.case_kind ?? DOCUMENT_STATUS_CASE_KIND,
      case_subkind: encodeCaseSubkind(documentTypeId, fieldId),
      enabled: config.enabled,
      config: config.config,
      updated_at: new Date(),
      updated_by: null
    });
  }
  const existingTemplates = await db.document.listDocumentTemplates(workspace, undefined, true);
  let templates = 0;
  for (const template of documents.templates) {
    if (hasSkipResolution(resolutions, template.id)) continue;
    if (template.project_id != null && !idMapping.projects.has(template.project_id)) continue;
    const projectId =
      template.project_id == null ? null : (idMapping.projects.get(template.project_id) ?? null);
    const documentTypeId = typeMapping.get(template.document_type_id);
    if (!documentTypeId) continue;
    const resolution = resolutions[template.id];
    const existing = existingTemplates.find(
      candidate =>
        candidate.id === template.id ||
        (candidate.project_id === projectId &&
          candidate.name.toLowerCase() === template.name.toLowerCase())
    );
    const reuseExisting = existing != null && resolution?.action !== 'rename';
    const templateId = reuseExisting
      ? existing.id
      : preserveIds && !existing
        ? template.id
        : randomUUID();
    const sourceType = documents.types.find(type => type.id === template.document_type_id);
    const metadataDefaults = sourceType
      ? remapDocumentMetadataValues(
          sourceType.fields,
          template.metadata_defaults,
          id => idMapping.entities.get(sourceEntityIdByIdentifier.get(id) ?? id),
          id => idMapping.content_nodes.get(id)
        )
      : template.metadata_defaults;
    const input = {
      workspace,
      project_id: projectId,
      name: template.name,
      body: template.body,
      document_type_id: documentTypeId,
      metadata_defaults: metadataDefaults,
      updated_at: new Date()
    };
    if (reuseExisting) {
      await db.document.updateDocumentTemplate(workspace, templateId, input);
      await db.document.archiveDocumentTemplate(
        workspace,
        templateId,
        template.archived,
        new Date()
      );
    } else {
      await db.document.createDocumentTemplate({
        id: templateId,
        ...input,
        created_at: new Date(template.created_at)
      });
      if (template.archived)
        await db.document.archiveDocumentTemplate(workspace, templateId, true, new Date());
      templates++;
    }
  }
  let metadataCount = 0;
  for (const item of documents.metadata) {
    const nodeId = idMapping.content_nodes.get(item.node_id);
    if (!nodeId) continue;
    const documentTypeId = item.document_type_id
      ? (typeMapping.get(item.document_type_id) ?? null)
      : null;
    if (item.document_type_id && !documentTypeId) continue;
    const sourceType = item.document_type_id
      ? documents.types.find(type => type.id === item.document_type_id)
      : null;
    const values = sourceType
      ? remapDocumentMetadataValues(
          sourceType.fields,
          item.values,
          id => idMapping.entities.get(sourceEntityIdByIdentifier.get(id) ?? id),
          id => idMapping.content_nodes.get(id)
        )
      : item.values;
    await db.document.upsertDocumentMetadata({
      workspace,
      node_id: nodeId,
      document_type_id: documentTypeId,
      values,
      generated_metadata: item.generated_metadata ?? {},
      updated_at: new Date()
    });
    const links = item.links.flatMap(link => {
      const targetId =
        link.target_type === 'entity'
          ? idMapping.entities.get(sourceEntityIdByIdentifier.get(link.target_id) ?? link.target_id)
          : idMapping.content_nodes.get(link.target_id);
      return targetId == null ? [] : [{ ...link, target_id: targetId }];
    });
    await db.document.replaceDocumentLinks(workspace, nodeId, links);
    metadataCount++;
  }
  const revisionMapping = new Map<string, string>();
  let revisions = 0;
  const orderedRevisions = [...documents.revisions].sort(
    (left, right) =>
      left.node_id.localeCompare(right.node_id) || left.revision_number - right.revision_number
  );
  for (const revision of orderedRevisions) {
    const nodeId = idMapping.content_nodes.get(revision.node_id);
    if (!nodeId) continue;
    const id = preserveIds ? revision.id : randomUUID();
    const createdBy =
      revision.created_by && (await db.auth.getUser(revision.created_by))
        ? revision.created_by
        : null;
    const documentTypeId = revision.document_type_id
      ? (typeMapping.get(revision.document_type_id) ?? null)
      : null;
    if (revision.document_type_id && !documentTypeId) continue;
    revisionMapping.set(revision.id, id);
    await db.project.createMarkdownRevision({
      id,
      workspace,
      node_id: nodeId,
      revision_number: revision.revision_number,
      title: revision.title,
      body: revision.body,
      created_at: new Date(revision.created_at),
      created_by: createdBy,
      restored_from_revision_id: revision.restored_from_revision_id
        ? (revisionMapping.get(revision.restored_from_revision_id) ?? null)
        : null,
      document_type_id: documentTypeId,
      metadata: (() => {
        const sourceType = revision.document_type_id
          ? documents.types.find(type => type.id === revision.document_type_id)
          : null;
        return sourceType
          ? remapDocumentMetadataValues(
              sourceType.fields,
              revision.metadata,
              id => idMapping.entities.get(sourceEntityIdByIdentifier.get(id) ?? id),
              id => idMapping.content_nodes.get(id)
            )
          : revision.metadata;
      })()
    });
    revisions++;
  }
  return { created, templates, metadata: metadataCount, revisions };
};
