import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { runAuthorizedOperation } from '../operation';
import { requireWorkspaceCapability } from '../auth/authorization';
import { httpAssert } from '../../utils/httpAssert';
import {
  buildCreateSharedFieldGroupInput,
  buildUpdateSharedFieldGroupInput,
  compileSchemaWithSharedGroups,
  isSharedFieldGroupReferencedBySchemas
} from './fieldGroupHelpers';
import { toApiSharedFieldGroup, toFieldMigrationFields } from './schemaHelpers';
import { assertCategoryExists, buildCategoryLookup } from './categoryOperations';
import {
  buildFieldChangeSummary,
  describeHardBlockedChange,
  planFieldMigrations,
  type FieldMigrationDataOperation
} from '../fieldMigration/fieldMigrationPlanning';
import type { PendingFieldChange } from '@arch-register/api-types/common';
import type {
  CreateSharedFieldGroupRequest,
  SharedFieldGroup,
  UpdateSharedFieldGroupRequest
} from '@arch-register/api-types/fieldGroupContract';
import { listAllCatalogEntities } from './entityLoader';
import {
  materializeDerivedFields,
  validateDerivedFieldGroupAccess
} from '../derived/derivedFields';
import { recalculateEntityDerivedFields } from '../derived/derivedRecalculation';
import { computeChanges, extractEntityFields, logAudit } from '../audit/db/auditLogging';
import { encodeCaseSubkind } from '../governance/governanceCaseSubkind';

const dbErrorMessages = {
  unique: 'A shared fieldgroup with that name already exists in this workspace',
  foreign: 'Cannot delete shared fieldgroup: it is still referenced by one or more schemas'
} as const;

const apiGroup = async (
  db: DatabaseAdapter,
  workspace: string,
  group: Awaited<ReturnType<DatabaseAdapter['catalog']['getSharedFieldGroup']>>
) => {
  httpAssert.present(group, { status: 404, message: 'Shared fieldgroup not found' });
  const [enums, categories] = await Promise.all([
    db.catalog.listEnums(workspace),
    buildCategoryLookup(db, workspace)
  ]);
  return toApiSharedFieldGroup(group, enums, categories);
};

export const listWorkspaceSharedFieldGroups = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<SharedFieldGroup[]> =>
  runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to retrieve shared fieldgroups',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'ws.view');
      const [groups, enums, categories] = await Promise.all([
        db.catalog.listSharedFieldGroups(ws),
        db.catalog.listEnums(ws),
        buildCategoryLookup(db, ws)
      ]);
      return groups.map(group => toApiSharedFieldGroup(group, enums, categories));
    }
  });

export const getWorkspaceSharedFieldGroup = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
): Promise<SharedFieldGroup> =>
  runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to retrieve shared fieldgroup',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'ws.view');
      return apiGroup(db, ws, await db.catalog.getSharedFieldGroup(ws, id));
    }
  });

export const createWorkspaceSharedFieldGroup = async (
  db: DatabaseAdapter,
  workspace: string,
  body: CreateSharedFieldGroupRequest,
  event: AuthenticatedEvent
): Promise<SharedFieldGroup> =>
  runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to create shared fieldgroup',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'schema.edit');
      const input = buildCreateSharedFieldGroupInput(ws, body, new Date());
      await assertCategoryExists(db, ws, input.category_id);
      const row = await db.catalog.createSharedFieldGroup(input);
      return apiGroup(db, ws, row);
    }
  });

export const updateWorkspaceSharedFieldGroup = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  body: UpdateSharedFieldGroupRequest,
  event: AuthenticatedEvent
): Promise<SharedFieldGroup> =>
  runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to update shared fieldgroup',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'schema.edit');
      const oldGroup = await db.catalog.getSharedFieldGroup(ws, id);
      httpAssert.present(oldGroup, { status: 404, message: `Shared fieldgroup '${id}' not found` });
      const next = buildUpdateSharedFieldGroupInput(body, oldGroup, new Date());
      await assertCategoryExists(db, ws, next.category_id);
      const fieldMigrations = body.fieldMigrations;
      const [schemas, groups, categories] = await Promise.all([
        db.catalog.listSchemas(ws),
        db.catalog.listSharedFieldGroups(ws),
        db.catalog.listCategories(ws)
      ]);
      const categoryNamesById = new Map(categories.map(category => [category.id, category.name]));
      const nextGroups = groups.map(group => (group.id === id ? { ...group, ...next } : group));
      const changesBySchema = new Map<
        string,
        {
          old: ReturnType<typeof compileSchemaWithSharedGroups>;
          next: ReturnType<typeof compileSchemaWithSharedGroups>;
          migrations: FieldMigrationDataOperation[];
          configMigrations: Array<{
            action: 'rename' | 'remove';
            oldFieldId: string;
            newFieldId?: string;
          }>;
        }
      >();

      for (const schema of schemas.filter(item =>
        (item.shared_field_group_links ?? []).some(link => link.groupId === id)
      )) {
        const oldEffective = compileSchemaWithSharedGroups(schema, groups);
        const nextEffective = compileSchemaWithSharedGroups(schema, nextGroups);
        const entities = await listAllCatalogEntities(db, ws, { schemaId: schema.id });
        const fieldMigrationPlan = planFieldMigrations(
          toFieldMigrationFields(oldEffective.fields),
          toFieldMigrationFields(nextEffective.fields),
          fieldMigrations,
          { decisionRequiredFieldIds: entities.length > 0 ? undefined : new Set<string>() }
        );
        httpAssert.true(fieldMigrationPlan.hardBlocked.length === 0, {
          status: 409,
          message: `Cannot update shared fieldgroup: ${fieldMigrationPlan.hardBlocked
            .map(change => describeHardBlockedChange(change))
            .join('; ')}`
        });
        const unresolved = fieldMigrationPlan.unresolved;
        if (entities.length > 0 && unresolved.length > 0) {
          const oldFieldsById = new Map(oldEffective.fields.map(field => [field.id, field]));
          const pendingChanges: PendingFieldChange[] = unresolved.map(change => ({
            fieldId: change.fieldId,
            fieldName: oldFieldsById.get(change.fieldId)?.name ?? change.fieldName,
            kind: change.kind,
            renamedToId: change.renamedToId,
            entityCount: entities.filter(
              entity =>
                entity.data[change.fieldId] !== undefined && entity.data[change.fieldId] !== null
            ).length
          }));
          httpAssert.true(false, {
            status: 409,
            message: `Shared fieldgroup changes require migration decisions (${pendingChanges.map(change => `${schema.name}: ${change.fieldName}`).join(', ')})`,
            data: { code: 'SCHEMA_MIGRATION_REQUIRED', pendingChanges }
          });
        }
        const migrations = fieldMigrationPlan.dataMigrations;
        for (const fieldId of fieldMigrationPlan.archiveFieldIds) {
          const oldField = oldEffective.fields.find(field => field.id === fieldId);
          if (oldField && !nextEffective.fields.some(field => field.id === oldField.id)) {
            nextEffective.fields.push({ ...oldField, archived: true });
          }
        }
        validateDerivedFieldGroupAccess(nextEffective.fields, nextEffective.groups ?? []);
        const configMigrations: Array<{
          action: 'rename' | 'remove';
          oldFieldId: string;
          newFieldId?: string;
        }> = [];
        for (const oldField of oldEffective.fields) {
          if (oldField.type !== 'date') continue;
          const change = fieldMigrationPlan.changes.find(
            candidate => candidate.fieldId === oldField.id
          );
          if (change?.kind === 'renamed' && change.renamedToId) {
            configMigrations.push({
              action: 'rename',
              oldFieldId: oldField.id,
              newFieldId: change.renamedToId
            });
            continue;
          }
          const nextField = nextEffective.fields.find(field => field.id === oldField.id);
          if (nextField?.type !== 'date' || nextField.archived) {
            configMigrations.push({ action: 'remove', oldFieldId: oldField.id });
          }
        }
        changesBySchema.set(schema.id, {
          old: oldEffective,
          next: nextEffective,
          migrations,
          configMigrations
        });
      }

      const now = new Date();
      const updated = await db.core.transaction(async tx => {
        const group = await tx.catalog.updateSharedFieldGroup(ws, id, next);
        httpAssert.present(group, { status: 404, message: `Shared fieldgroup '${id}' not found` });
        for (const [schemaId, change] of changesBySchema) {
          for (const migration of change.migrations) {
            if (migration.action === 'rename')
              await tx.catalog.renameEntityDataField(
                ws,
                schemaId,
                migration.oldFieldId,
                migration.newFieldId
              );
            else await tx.catalog.removeEntityDataField(ws, schemaId, migration.oldFieldId);
          }
          for (const migration of change.configMigrations) {
            const oldSubkind = encodeCaseSubkind(schemaId, migration.oldFieldId);
            if (migration.action === 'rename') {
              const config = await tx.governanceCaseConfig.getCaseConfig(
                ws,
                'field-date-reminder',
                oldSubkind
              );
              if (config) {
                await tx.governanceCaseConfig.upsertCaseConfig({
                  workspace: ws,
                  case_kind: config.case_kind,
                  case_subkind: encodeCaseSubkind(schemaId, migration.newFieldId),
                  enabled: config.enabled,
                  config: config.config,
                  updated_at: now,
                  updated_by: authCtx.userId
                });
              }
            }
            await tx.governanceCaseConfig.deleteCaseConfigForSubkindOrDescendants(ws, oldSubkind);
          }
          const current = schemas.find(schema => schema.id === schemaId)!;
          const row = await tx.catalog.updateSchema(ws, schemaId, {
            ...current,
            fields: change.next.fields,
            groups: change.next.groups,
            shared_field_group_links: current.shared_field_group_links ?? [],
            version: (current.version ?? 1) + 1,
            updated_at: now
          });
          httpAssert.present(row, { status: 404, message: `Schema '${schemaId}' not found` });
          await tx.catalog.createSchemaVersion({
            id: randomUUID(),
            workspace: ws,
            schema_id: schemaId,
            version: row.version ?? 1,
            name: row.name,
            category: (row.category_id && categoryNamesById.get(row.category_id)) ?? null,
            description: row.description,
            fields: row.fields,
            templates: row.templates ?? [],
            groups: row.groups ?? [],
            shared_field_group_links: row.shared_field_group_links ?? [],
            color: row.color,
            icon: row.icon,
            change_summary: buildFieldChangeSummary(
              toFieldMigrationFields(change.old.fields),
              toFieldMigrationFields(row.fields),
              fieldMigrations
            ),
            created_by: authCtx.userId,
            created_at: now
          });
          const entities = await listAllCatalogEntities(tx, ws, { schemaId });
          for (const entity of entities) {
            await tx.catalog.updateEntityDerivedFields(
              ws,
              entity.id,
              materializeDerivedFields(
                row.fields,
                entity.data,
                {
                  objectType: 'entity',
                  objectId: entity.id
                },
                row.groups ?? []
              )
            );
          }
        }
        await recalculateEntityDerivedFields(tx, ws);
        return group;
      });
      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'update',
        entityType: 'workspace_field_group',
        entityId: id,
        entityName: updated.name,
        changes: computeChanges(extractEntityFields(oldGroup), extractEntityFields(updated)),
        metadata: fieldMigrations ? { fieldMigrations } : undefined
      });
      return apiGroup(db, ws, updated);
    }
  });

export const deleteWorkspaceSharedFieldGroup = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
) =>
  runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to delete shared fieldgroup',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'schema.edit');
      const schemas = await db.catalog.listSchemas(ws);
      httpAssert.true(!isSharedFieldGroupReferencedBySchemas(schemas, id), {
        status: 409,
        message: 'Cannot delete shared fieldgroup: it is still referenced by one or more schemas'
      });
      const row = await db.catalog.getSharedFieldGroup(ws, id);
      httpAssert.present(row, { status: 404, message: `Shared fieldgroup '${id}' not found` });
      await db.catalog.deleteSharedFieldGroup(ws, id);
      return { success: true, message: `Shared fieldgroup '${id}' deleted` };
    }
  });
