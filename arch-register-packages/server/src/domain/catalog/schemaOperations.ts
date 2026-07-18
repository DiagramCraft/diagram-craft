import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { logAudit, extractEntityFields, computeChanges } from '../audit/db/auditLogging';
import { requireSchemaRead, requireWorkspaceCapability } from '../auth/authorization';
import { defineOperation } from '../operation';
import { handleDbError } from '../../utils/http';
import { httpAssert } from '../../utils/httpAssert';
import { countEntities } from './entityOperations';
import { listAllCatalogEntities } from './entityLoader';
import {
  toApiSchema,
  toApiSchemaVersion,
  buildCreateSchemaInput,
  buildUpdateSchemaInput,
  buildSchemaChangeSummary,
  classifyFieldChanges,
  hardBlockedFieldChanges,
  migratableFieldChanges,
  describeHardBlockedChange,
  findUnresolvedFieldMigrations
} from './schemaHelpers';
import {
  EntitySchema,
  FieldMigrations,
  PendingFieldChange,
  SchemaVersion
} from '@arch-register/api-types/schemaContract';

const dbErrorMessages = {
  unique: 'A schema with that name already exists in this workspace',
  foreign: 'Cannot delete schema: entities still reference it'
} as const;

export const listWorkspaceSchemas = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<EntitySchema[]> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to retrieve schemas',
      dbErrorMessages
    },
    async ({ ws, authCtx }) => {
      requireSchemaRead(authCtx);
      const [schemas, enums, allEntities] = await Promise.all([
        db.catalog.listSchemas(ws),
        db.catalog.listEnums(ws),
        listAllCatalogEntities(db, ws)
      ]);
      const countBySchema = new Map<string, number>();
      for (const entity of allEntities) {
        countBySchema.set(entity.schema_id, (countBySchema.get(entity.schema_id) ?? 0) + 1);
      }
      return schemas.map(schema => toApiSchema(schema, countBySchema.get(schema.id) ?? 0, enums));
    }
  );
};

export const getWorkspaceSchema = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
): Promise<EntitySchema> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to retrieve schema',
      dbErrorMessages
    },
    async ({ ws, authCtx }) => {
      requireSchemaRead(authCtx);
      const [row, enums] = await Promise.all([
        db.catalog.getSchema(ws, id),
        db.catalog.listEnums(ws)
      ]);
      httpAssert.present(row, { status: 404, message: `Schema '${id}' not found` });
      const entityCount = await countEntities(db, ws, null, {
        schemaId: id
      });
      return toApiSchema(row, entityCount, enums);
    }
  );
};

export const createWorkspaceSchema = async (
  db: DatabaseAdapter,
  workspace: string,
  body: Record<string, unknown>,
  event: AuthenticatedEvent
): Promise<EntitySchema> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to create schema',
      dbErrorMessages
    },
    async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'schema.edit');
      const teamIds = new Set((await db.workspace.listTeams(ws)).map(owner => owner.id));
      const timestamp = new Date();
      const row = await db.catalog.createSchema(
        buildCreateSchemaInput(ws, body, teamIds, timestamp)
      );
      httpAssert.present(row.key_prefix, {
        status: 409,
        message: `Schema '${row.id}' is missing a key prefix`
      });
      await db.workspace.registerPublicIdPrefix(row.key_prefix, 'schema', row.id, timestamp);

      await db.catalog.createSchemaVersion({
        id: randomUUID(),
        workspace: ws,
        schema_id: row.id,
        version: row.version ?? 1,
        name: row.name,
        description: row.description,
        fields: row.fields,
        templates: row.templates ?? [],
        color: row.color,
        icon: row.icon,
        change_summary: buildSchemaChangeSummary(null, row.fields),
        created_by: authCtx.userId,
        created_at: timestamp
      });

      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'create',
        entityType: 'entity_schema',
        entityId: row.id,
        entityName: row.name,
        changes: { new: extractEntityFields(row) }
      });

      const enums = await db.catalog.listEnums(ws);
      return toApiSchema(row, 0, enums);
    }
  );
};

export const updateWorkspaceSchema = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  body: Record<string, unknown>,
  event: AuthenticatedEvent
): Promise<EntitySchema> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to update schema',
      dbErrorMessages
    },
    async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'schema.edit');
      const oldRow = await db.catalog.getSchema(ws, id);
      httpAssert.present(oldRow, { status: 404, message: `Schema '${id}' not found` });

      const teamIds = new Set((await db.workspace.listTeams(ws)).map(owner => owner.id));
      const next = buildUpdateSchemaInput(body, oldRow, teamIds, new Date());
      const fieldMigrations = body.fieldMigrations as FieldMigrations | undefined;

      const entityCount = await countEntities(db, ws, null, {
        schemaId: id
      });

      const finalFields = [...next.fields];
      const dataMigrations: Array<{
        action: 'rename' | 'remove';
        oldFieldId: string;
        newFieldId?: string;
      }> = [];

      if (entityCount > 0) {
        const fieldChanges = classifyFieldChanges(oldRow.fields, next.fields);

        const blocked = hardBlockedFieldChanges(fieldChanges);
        httpAssert.true(blocked.length === 0, {
          status: 409,
          message: `Cannot update schema: ${blocked.map(describeHardBlockedChange).join('; ')}`
        });

        const migratable = migratableFieldChanges(fieldChanges);
        const unresolved = findUnresolvedFieldMigrations(fieldChanges, fieldMigrations);
        if (unresolved.length > 0) {
          const oldFieldsById = new Map(oldRow.fields.map(field => [field.id, field]));
          const entities = await listAllCatalogEntities(db, ws, { schemaId: id });
          const pendingChanges: PendingFieldChange[] = unresolved.map(change => ({
            fieldId: change.fieldId,
            fieldName: oldFieldsById.get(change.fieldId)?.name ?? change.fieldName,
            kind: change.kind as 'removed' | 'renamed',
            renamedToId: change.renamedToId,
            entityCount: entities.filter(
              entity =>
                entity.data[change.fieldId] !== undefined && entity.data[change.fieldId] !== null
            ).length
          }));
          httpAssert.true(false, {
            status: 409,
            message: `Cannot update schema: field changes require a migration decision (${pendingChanges.map(c => c.fieldName).join(', ')})`,
            data: { code: 'SCHEMA_MIGRATION_REQUIRED', pendingChanges }
          });
        }

        const oldFieldsById = new Map(oldRow.fields.map(field => [field.id, field]));
        for (const change of migratable) {
          const migration = fieldMigrations?.[change.fieldId];
          httpAssert.present(migration, {
            message: `Missing migration decision for field "${change.fieldName}"`
          });
          if (migration.action === 'archive') {
            const oldField = oldFieldsById.get(change.fieldId);
            if (oldField && !finalFields.some(field => field.id === oldField.id)) {
              finalFields.push({ ...oldField, archived: true });
            }
          } else if (migration.action === 'rename') {
            const targetId = migration.renameTo ?? change.renamedToId;
            httpAssert.string(targetId, {
              message: `renameTo is required to rename field "${change.fieldName}"`
            });
            dataMigrations.push({
              action: 'rename',
              oldFieldId: change.fieldId,
              newFieldId: targetId
            });
          } else {
            dataMigrations.push({ action: 'remove', oldFieldId: change.fieldId });
          }
        }
      }

      const changeSummary = buildSchemaChangeSummary(oldRow.fields, finalFields, fieldMigrations);

      const row = await db.core.transaction(async tx => {
        for (const migration of dataMigrations) {
          if (migration.action === 'rename') {
            await tx.catalog.renameEntityDataField(
              ws,
              id,
              migration.oldFieldId,
              migration.newFieldId!
            );
          } else {
            await tx.catalog.removeEntityDataField(ws, id, migration.oldFieldId);
          }
        }

        const updated = await tx.catalog.updateSchema(ws, id, {
          name: next.name,
          key_prefix: next.key_prefix,
          description: next.description,
          fields: finalFields,
          templates: next.templates,
          color: next.color,
          icon: next.icon,
          default_owner: next.defaultOwner,
          entity_approval_policy: next.entityApprovalPolicy,
          deprecation_policy: next.deprecationPolicy,
          version: (oldRow.version ?? 1) + 1,
          updated_at: next.updated_at
        });
        httpAssert.present(updated, { status: 404, message: `Schema '${id}' not found` });

        if (oldRow.key_prefix !== updated.key_prefix) {
          try {
            await tx.workspace.updatePublicIdPrefix(
              oldRow.key_prefix,
              updated.key_prefix,
              'schema',
              id,
              next.updated_at
            );
          } catch (error) {
            handleDbError(error, 'Failed to update key prefix', {
              unique: 'A schema with that key prefix already exists'
            });
          }
        }

        await tx.catalog.createSchemaVersion({
          id: randomUUID(),
          workspace: ws,
          schema_id: id,
          version: updated.version ?? 1,
          name: updated.name,
          description: updated.description,
          fields: updated.fields,
          templates: updated.templates ?? [],
          color: updated.color,
          icon: updated.icon,
          change_summary: changeSummary,
          created_by: authCtx.userId,
          created_at: next.updated_at
        });

        return updated;
      });

      const changes = computeChanges(extractEntityFields(oldRow), extractEntityFields(row));

      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'update',
        entityType: 'entity_schema',
        entityId: id,
        entityName: row.name,
        changes,
        metadata: fieldMigrations ? { fieldMigrations } : undefined
      });

      const enums = await db.catalog.listEnums(ws);
      return toApiSchema(row, entityCount, enums);
    }
  );
};

export const listWorkspaceSchemaVersions = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
): Promise<SchemaVersion[]> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to retrieve schema version history',
      dbErrorMessages
    },
    async ({ ws, authCtx }) => {
      requireSchemaRead(authCtx);
      const schema = await db.catalog.getSchema(ws, id);
      httpAssert.present(schema, { status: 404, message: `Schema '${id}' not found` });
      const [versions, enums] = await Promise.all([
        db.catalog.listSchemaVersions(ws, id),
        db.catalog.listEnums(ws)
      ]);
      return versions.map(version => toApiSchemaVersion(version, enums));
    }
  );
};

export const deleteWorkspaceSchema = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; message: string }> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to delete schema',
      dbErrorMessages
    },
    async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'schema.edit');
      const schema = await db.catalog.getSchema(ws, id);
      httpAssert.present(schema, { status: 404, message: `Schema '${id}' not found` });

      const entityCount = await countEntities(db, ws, null, {
        schemaId: id
      });
      httpAssert.true(entityCount === 0, {
        status: 409,
        message: 'Cannot delete schema: entities still reference it'
      });

      await db.catalog.deleteSchema(ws, id);
      if (schema.key_prefix) {
        await db.workspace.deletePublicIdPrefix(schema.key_prefix);
      }

      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'delete',
        entityType: 'entity_schema',
        entityId: id,
        entityName: schema.name,
        changes: { old: extractEntityFields(schema) }
      });

      return { success: true, message: `Schema '${id}' deleted` };
    }
  );
};
