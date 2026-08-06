import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { logAudit, extractEntityFields, computeChanges } from '../audit/db/auditLogging';
import { requireSchemaRead, requireWorkspaceCapability } from '../auth/authorization';
import { defineOperation } from '../operation';
import { httpAssert } from '../../utils/httpAssert';
import {
  classifyFieldChanges,
  describeHardBlockedChange,
  findUnresolvedFieldMigrations,
  hardBlockedFieldChanges,
  migratableFieldChanges
} from './schemaHelpers';
import {
  asSchemaFields,
  buildCreateRelationSchemaInput,
  buildUpdateRelationSchemaInput,
  buildRelationSchemaChangeSummary,
  compileRelationSchemaWithSharedGroups,
  toApiRelationSchema,
  toApiRelationSchemaVersion
} from './relationSchemaHelpers';
import type { FieldMigrations, PendingFieldChange } from '@arch-register/api-types/schemaContract';
import type {
  RelationSchema,
  RelationSchemaVersion
} from '@arch-register/api-types/relationSchemaContract';

const dbErrorMessages = {
  unique: 'A relation schema with that name already exists in this workspace',
  foreign: 'Cannot delete relation schema: relation instances still reference it'
} as const;

export const listWorkspaceRelationSchemas = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<RelationSchema[]> => {
  return defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to retrieve relation schemas', dbErrorMessages },
    async ({ ws, authCtx }) => {
      requireSchemaRead(authCtx);
      const [schemas, enums] = await Promise.all([
        db.relation.listRelationSchemas(ws),
        db.catalog.listEnums(ws)
      ]);
      const counts = await Promise.all(
        schemas.map(schema => db.relation.countRelationsForSchema(ws, schema.id))
      );
      return schemas.map((schema, i) => toApiRelationSchema(schema, counts[i]!, enums));
    }
  );
};

export const getWorkspaceRelationSchema = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
): Promise<RelationSchema> => {
  return defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to retrieve relation schema', dbErrorMessages },
    async ({ ws, authCtx }) => {
      requireSchemaRead(authCtx);
      const [row, enums] = await Promise.all([
        db.relation.getRelationSchema(ws, id),
        db.catalog.listEnums(ws)
      ]);
      httpAssert.present(row, { status: 404, message: `Relation schema '${id}' not found` });
      const relationCount = await db.relation.countRelationsForSchema(ws, id);
      return toApiRelationSchema(row, relationCount, enums);
    }
  );
};

export const createWorkspaceRelationSchema = async (
  db: DatabaseAdapter,
  workspace: string,
  body: Record<string, unknown>,
  event: AuthenticatedEvent
): Promise<RelationSchema> => {
  return defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to create relation schema', dbErrorMessages },
    async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'schema.edit');
      const timestamp = new Date();
      const [entitySchemas, sharedGroups] = await Promise.all([
        db.catalog.listSchemas(ws),
        db.catalog.listSharedFieldGroups(ws)
      ]);
      const knownEntitySchemaIds = new Set(entitySchemas.map(schema => schema.id));
      const requested = buildCreateRelationSchemaInput(ws, body, knownEntitySchemaIds, timestamp);
      const compiled = compileRelationSchemaWithSharedGroups(requested, sharedGroups);
      const row = await db.relation.createRelationSchema(compiled);

      await db.relation.createRelationSchemaVersion({
        id: randomUUID(),
        workspace: ws,
        schema_id: row.id,
        version: row.version ?? 1,
        name: row.name,
        description: row.description,
        in_schema_ids: row.in_schema_ids,
        out_schema_ids: row.out_schema_ids,
        fields: row.fields,
        groups: row.groups ?? [],
        color: row.color,
        icon: row.icon,
        change_summary: buildRelationSchemaChangeSummary(null, row.fields),
        created_by: authCtx.userId,
        created_at: timestamp
      });

      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'create',
        entityType: 'relation_schema',
        entityId: row.id,
        entityName: row.name,
        changes: { new: extractEntityFields(row) }
      });

      const enums = await db.catalog.listEnums(ws);
      return toApiRelationSchema(row, 0, enums);
    }
  );
};

export const updateWorkspaceRelationSchema = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  body: Record<string, unknown>,
  event: AuthenticatedEvent
): Promise<RelationSchema> => {
  return defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to update relation schema', dbErrorMessages },
    async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'schema.edit');
      const oldRow = await db.relation.getRelationSchema(ws, id);
      httpAssert.present(oldRow, { status: 404, message: `Relation schema '${id}' not found` });

      const [entitySchemas, sharedGroups] = await Promise.all([
        db.catalog.listSchemas(ws),
        db.catalog.listSharedFieldGroups(ws)
      ]);
      const knownEntitySchemaIds = new Set(entitySchemas.map(schema => schema.id));
      const next = buildUpdateRelationSchemaInput(body, oldRow, knownEntitySchemaIds, new Date());
      const compiledNext = compileRelationSchemaWithSharedGroups(
        { ...oldRow, ...next, shared_field_group_links: next.shared_field_group_links },
        sharedGroups
      );
      const fieldMigrations = body.fieldMigrations as FieldMigrations | undefined;

      const relationCount = await db.relation.countRelationsForSchema(ws, id);

      const finalFields = [...compiledNext.fields];
      const dataMigrations: Array<{
        action: 'rename' | 'remove';
        oldFieldId: string;
        newFieldId?: string;
      }> = [];

      if (relationCount > 0) {
        const fieldChanges = classifyFieldChanges(
          asSchemaFields(oldRow.fields),
          asSchemaFields(compiledNext.fields)
        );

        const blocked = hardBlockedFieldChanges(fieldChanges);
        httpAssert.true(blocked.length === 0, {
          status: 409,
          message: `Cannot update relation schema: ${blocked.map(describeHardBlockedChange).join('; ')}`
        });

        const migratable = migratableFieldChanges(fieldChanges);
        const unresolved = findUnresolvedFieldMigrations(fieldChanges, fieldMigrations);
        if (unresolved.length > 0) {
          const pendingChanges: PendingFieldChange[] = unresolved.map(change => ({
            fieldId: change.fieldId,
            fieldName: change.fieldName,
            kind: change.kind as 'removed' | 'renamed',
            renamedToId: change.renamedToId,
            entityCount: 0
          }));
          httpAssert.true(false, {
            status: 409,
            message: `Cannot update relation schema: field changes require a migration decision (${pendingChanges.map(c => c.fieldName).join(', ')})`,
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

      const changeSummary = buildRelationSchemaChangeSummary(
        oldRow.fields,
        finalFields,
        fieldMigrations
      );

      const row = await db.core.transaction(async tx => {
        for (const migration of dataMigrations) {
          if (migration.action === 'rename') {
            await tx.relation.renameRelationDataField(
              ws,
              id,
              migration.oldFieldId,
              migration.newFieldId!
            );
          } else {
            await tx.relation.removeRelationDataField(ws, id, migration.oldFieldId);
          }
        }

        const updated = await tx.relation.updateRelationSchema(ws, id, {
          name: next.name,
          description: next.description,
          in_schema_ids: next.in_schema_ids,
          out_schema_ids: next.out_schema_ids,
          fields: finalFields,
          groups: compiledNext.groups,
          shared_field_group_links: compiledNext.shared_field_group_links ?? [],
          color: next.color,
          icon: next.icon,
          relation_approval_policy: next.relation_approval_policy,
          version: (oldRow.version ?? 1) + 1,
          updated_at: next.updated_at
        });
        httpAssert.present(updated, { status: 404, message: `Relation schema '${id}' not found` });

        await tx.relation.createRelationSchemaVersion({
          id: randomUUID(),
          workspace: ws,
          schema_id: id,
          version: updated.version ?? 1,
          name: updated.name,
          description: updated.description,
          in_schema_ids: updated.in_schema_ids,
          out_schema_ids: updated.out_schema_ids,
          fields: updated.fields,
          groups: updated.groups ?? [],
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
        entityType: 'relation_schema',
        entityId: id,
        entityName: row.name,
        changes,
        metadata: fieldMigrations ? { fieldMigrations } : undefined
      });

      const enums = await db.catalog.listEnums(ws);
      return toApiRelationSchema(row, relationCount, enums);
    }
  );
};

export const listWorkspaceRelationSchemaVersions = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
): Promise<RelationSchemaVersion[]> => {
  return defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to retrieve relation schema version history', dbErrorMessages },
    async ({ ws, authCtx }) => {
      requireSchemaRead(authCtx);
      const schema = await db.relation.getRelationSchema(ws, id);
      httpAssert.present(schema, { status: 404, message: `Relation schema '${id}' not found` });
      const [versions, enums] = await Promise.all([
        db.relation.listRelationSchemaVersions(ws, id),
        db.catalog.listEnums(ws)
      ]);
      return versions.map(version => toApiRelationSchemaVersion(version, enums));
    }
  );
};

export const deleteWorkspaceRelationSchema = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; message: string }> => {
  return defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to delete relation schema', dbErrorMessages },
    async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'schema.edit');
      const schema = await db.relation.getRelationSchema(ws, id);
      httpAssert.present(schema, { status: 404, message: `Relation schema '${id}' not found` });

      const relationCount = await db.relation.countRelationsForSchema(ws, id);
      httpAssert.true(relationCount === 0, {
        status: 409,
        message: 'Cannot delete relation schema: relation instances still reference it'
      });

      await db.relation.deleteRelationSchema(ws, id);

      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'delete',
        entityType: 'relation_schema',
        entityId: id,
        entityName: schema.name,
        changes: { old: extractEntityFields(schema) }
      });

      return { success: true, message: `Relation schema '${id}' deleted` };
    }
  );
};
