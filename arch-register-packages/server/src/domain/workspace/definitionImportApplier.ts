import { randomUUID } from 'node:crypto';
import type { DefinitionImportExecuteResponse } from '@arch-register/api-types/workspaceContract';
import type { SchemaField } from '@arch-register/api-types/schemaContract';
import { isReferenceOrContainmentField } from '@arch-register/api-types/schemaContract';
import type { RelationField } from '@arch-register/api-types/relationSchemaContract';
import { isEntityRelationField } from '@arch-register/api-types/relationSchemaContract';
import type { WorkspaceCapabilityBindings } from '@arch-register/api-types/workspaceCapabilityContract';
import {
  entityDrawerConfigurationSchema,
  mergeEntityDrawerProfiles
} from '@arch-register/api-types/entityDrawerConfiguration';
import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import { httpAssert } from '../../utils/httpAssert';
import { SCHEMA_TEMPLATES, resolveTemplateDashboardWidgets } from '../catalog/schemaTemplates';
import type {
  SchemaDbCreate,
  SharedFieldGroupDbCreate,
  WorkspaceEnumDbCreate
} from '../catalog/db/catalogDatabase';
import type { RelationSchemaDbCreate } from '../catalog/db/relationDatabase';
import {
  assertResolvedFieldGroupReferences,
  toFieldMigrationFields as toSchemaFieldMigrationFields
} from '../catalog/schemaHelpers';
import { toFieldMigrationFields as toRelationFieldMigrationFields } from '../catalog/relationSchemaHelpers';
import { buildFieldChangeSummary } from '../fieldMigration/fieldMigrationPlanning';
import { validateDerivedFieldGroupAccess } from '../derived/derivedFields';
import { writeAudit } from '../audit/db/auditLogging';
import {
  appendWorkspaceDashboardLayout,
  replaceDefaultWorkspaceDashboardLayout
} from '../dashboard/dashboardOperations';
import type { DefinitionImportPlan, ImportableFieldGroup } from './definitionImportTypes';

const lower = (value: string) => value.toLocaleLowerCase();

export const applyDefinitionImport = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: WorkspaceAuthorizationContext,
  plan: DefinitionImportPlan
): Promise<DefinitionImportExecuteResponse> => {
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
    for (const group of relationSchema.shared_field_groups) sharedGroupSources.set(group.id, group);
  }
  for (const group of plan.fieldGroups) sharedGroupSources.set(group.id, group);
  const sharedFieldGroupMap = new Map([...sharedGroupSources.keys()].map(id => [id, randomUUID()]));
  const selectedFieldGroupIdsForAudit = new Set(plan.selection.fieldGroups);
  const targetTeams = await db.workspace.listTeams(workspace);
  const targetTeamByName = new Map(targetTeams.map(team => [lower(team.name), team.id]));
  const teamIdMap = new Map(
    Object.entries(plan.sourceTeamNames).flatMap(([sourceId, name]) => {
      const targetId = targetTeamByName.get(lower(name));
      return targetId ? [[sourceId, targetId] as const] : [];
    })
  );
  const remapSchemaField = (field: SchemaField): SchemaField => {
    const groupId =
      field.groupId && sharedFieldGroupMap.has(field.groupId)
        ? sharedFieldGroupMap.get(field.groupId)!
        : field.groupId;
    const group = groupId === undefined ? {} : { groupId };
    if (isReferenceOrContainmentField(field)) {
      return { ...field, ...group, schemaId: schemaIdMap.get(field.schemaId) ?? field.schemaId };
    }
    if (field.type === 'typedRelation') {
      return {
        ...field,
        ...group,
        relationSchemaId: relationSchemaIdMap.get(field.relationSchemaId) ?? field.relationSchemaId
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
      return { ...field, ...group, schemaId: schemaIdMap.get(field.schemaId) ?? field.schemaId };
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
      const existing = await tx.catalog.getCategoryByName(workspace, rawName);
      if (existing) {
        categoryIdCache.set(key, existing.id);
        return existing.id;
      }
      const created = await tx.catalog.createCategory({
        id: randomUUID(),
        workspace,
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
        workspace,
        name: enumeration.name,
        options: enumeration.options,
        sort_order: enumeration.sort_order,
        created_at: now,
        updated_at: now
      };
      await tx.catalog.createEnum(row);
      await writeAudit(tx, {
        userId: authCtx.userId,
        workspace,
        operation: 'create',
        entityType: 'workspace_enum',
        entityId: row.id,
        entityName: row.name,
        changes: { new: { ...row, created_at: now.toISOString(), updated_at: now.toISOString() } },
        metadata: { importedFrom: plan.source }
      });
    }

    for (const [sourceId, group] of sharedGroupSources) {
      const row: SharedFieldGroupDbCreate = {
        id: sharedFieldGroupMap.get(sourceId)!,
        workspace,
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
          workspace,
          operation: 'create',
          entityType: 'workspace_field_group',
          entityId: row.id,
          entityName: row.name,
          changes: {
            new: { ...row, created_at: now.toISOString(), updated_at: now.toISOString() }
          },
          metadata: { importedFrom: plan.source }
        });
      }
    }

    for (const schema of plan.schemas) {
      const fields = schema.fields.map(remapSchemaField);
      const groups = schema.groups.map(group => ({
        ...group,
        id: sharedFieldGroupMap.get(group.id) ?? group.id,
        accessControl: group.accessControl
          ? { teamIds: group.accessControl.teamIds.map(id => teamIdMap.get(id) ?? id) }
          : undefined
      }));
      assertResolvedFieldGroupReferences(fields, groups);
      validateDerivedFieldGroupAccess(fields, groups);
      const row: SchemaDbCreate = {
        id: schemaIdMap.get(schema.id)!,
        workspace,
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
          ? (targetTeams.find(team => lower(team.name) === lower(schema.default_owner_name!))?.id ??
            null)
          : null,
        created_at: now,
        updated_at: now
      };
      await tx.catalog.createSchema(row);
      await tx.workspace.registerPublicIdPrefix(row.key_prefix, 'schema', row.id, now);
      await tx.catalog.createSchemaVersion({
        id: randomUUID(),
        workspace,
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
        workspace,
        operation: 'create',
        entityType: 'entity_schema',
        entityId: row.id,
        entityName: row.name,
        changes: { new: { ...row, created_at: now.toISOString(), updated_at: now.toISOString() } },
        metadata: { importedFrom: plan.source }
      });
    }

    for (const relationSchema of plan.relationSchemas) {
      const fields = relationSchema.fields.map(remapRelationField);
      const groups = relationSchema.groups.map(group => ({
        ...group,
        id: sharedFieldGroupMap.get(group.id) ?? group.id,
        accessControl: group.accessControl
          ? { teamIds: group.accessControl.teamIds.map(id => teamIdMap.get(id) ?? id) }
          : undefined
      }));
      assertResolvedFieldGroupReferences(fields, groups);
      validateDerivedFieldGroupAccess(fields, groups, 'relation');
      const row: RelationSchemaDbCreate = {
        id: relationSchemaIdMap.get(relationSchema.id)!,
        workspace,
        name: relationSchema.name,
        category_id: await resolveCategoryId(relationSchema.category),
        description: relationSchema.description,
        in_schema_ids:
          relationSchema.in_schema_ids === 'any'
            ? 'any'
            : relationSchema.in_schema_ids.map(id => schemaIdMap.get(id) ?? id),
        out_schema_ids:
          relationSchema.out_schema_ids === 'any'
            ? 'any'
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
        unique_endpoint_pair: relationSchema.unique_endpoint_pair ?? false,
        created_at: now,
        updated_at: now
      };
      await tx.relation.createRelationSchema(row);
      await tx.relation.createRelationSchemaVersion({
        id: randomUUID(),
        workspace,
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
        unique_endpoint_pair: row.unique_endpoint_pair ?? false,
        change_summary: buildFieldChangeSummary(null, toRelationFieldMigrationFields(fields)),
        created_by: authCtx.userId,
        created_at: now
      });
      await writeAudit(tx, {
        userId: authCtx.userId,
        workspace,
        operation: 'create',
        entityType: 'relation_schema',
        entityId: row.id,
        entityName: row.name,
        changes: { new: { ...row, created_at: now.toISOString(), updated_at: now.toISOString() } },
        metadata: { importedFrom: plan.source }
      });
    }

    const patchesByTarget = new Map<string, DefinitionImportPlan['schemaPatches']>();
    for (const patch of plan.schemaPatches) {
      const targetSchemaId = schemaIdMap.get(patch.targetSchemaId) ?? patch.targetSchemaId;
      const patches = patchesByTarget.get(targetSchemaId) ?? [];
      patches.push(patch);
      patchesByTarget.set(targetSchemaId, patches);
    }
    for (const [targetSchemaId, patches] of patchesByTarget) {
      const current = await tx.catalog.getSchema(workspace, targetSchemaId);
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
      const updated = await tx.catalog.updateSchema(workspace, targetSchemaId, {
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
        ? ((await tx.catalog.getCategory(workspace, updated.category_id))?.name ?? null)
        : null;
      await tx.catalog.createSchemaVersion({
        id: randomUUID(),
        workspace,
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
        workspace,
        operation: 'update',
        entityType: 'entity_schema',
        entityId: updated.id,
        entityName: updated.name,
        changes: {
          old: { fields: current.fields, version: current.version ?? 1 },
          new: { fields: updated.fields, version: updated.version ?? 1 }
        },
        metadata: { importedFrom: plan.source, schemaPatch: true }
      });
    }

    for (const documentType of plan.documentTypes) {
      const id = documentTypeIdMap.get(documentType.id)!;
      await tx.document.createDocumentType({
        id,
        workspace,
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
        workspace,
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
            { ...binding, target: { ...binding.target, id: targetId ?? binding.target.id } }
          ];
        })
      ) as WorkspaceCapabilityBindings;
      await tx.workspace.upsertWorkspaceCapabilityConfiguration({
        id: randomUUID(),
        workspace,
        type: configuration.type,
        bindings,
        view_config: configuration.view_config ?? null,
        created_at: now,
        updated_at: now
      });
    }

    const importedDrawerProfiles = Object.fromEntries(
      Object.entries(plan.entityDrawerProfiles).flatMap(([sourceSchemaId, profile]) => {
        const targetSchemaId = schemaIdMap.get(sourceSchemaId);
        return targetSchemaId ? [[targetSchemaId, profile] as const] : [];
      })
    );
    if (Object.keys(importedDrawerProfiles).length > 0) {
      const existingDrawerConfiguration =
        await tx.workspace.getWorkspaceEntityDrawerConfiguration(workspace);
      const parsedExistingDrawerConfiguration = entityDrawerConfigurationSchema.safeParse(
        existingDrawerConfiguration?.configuration
      );
      if (!existingDrawerConfiguration || parsedExistingDrawerConfiguration.success) {
        await tx.workspace.upsertWorkspaceEntityDrawerConfiguration({
          workspace,
          configuration: {
            version: 1,
            profiles: mergeEntityDrawerProfiles(
              parsedExistingDrawerConfiguration.success
                ? parsedExistingDrawerConfiguration.data.profiles
                : {},
              importedDrawerProfiles
            )
          },
          created_at: existingDrawerConfiguration?.created_at ?? now,
          updated_at: now
        });
      }
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
          workspace,
          builtinTemplate.name,
          widgets,
          authCtx.userId
        );
      } else {
        await replaceDefaultWorkspaceDashboardLayout(tx, workspace, widgets, authCtx.userId);
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
};
