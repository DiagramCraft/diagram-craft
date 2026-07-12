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
  buildCreateSchemaInput,
  buildUpdateSchemaInput,
  findIncompatibleFieldChanges
} from './schemaHelpers';
import { EntitySchema } from '@arch-register/api-types/schemaContract';

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

      const entityCount = await countEntities(db, ws, null, {
        schemaId: id
      });
      if (entityCount > 0) {
        const incompatibleChanges = findIncompatibleFieldChanges(oldRow.fields, next.fields);
        httpAssert.true(incompatibleChanges.length === 0, {
          status: 409,
          message: `Cannot update schema: ${incompatibleChanges.join('; ')}`
        });
      }

      const row = await db.catalog.updateSchema(ws, id, {
        name: next.name,
        key_prefix: next.key_prefix,
        description: next.description,
        fields: next.fields,
        color: next.color,
        icon: next.icon,
        default_owner: next.defaultOwner,
        updated_at: next.updated_at
      });

      httpAssert.present(row, { status: 404, message: `Schema '${id}' not found` });
      if (oldRow.key_prefix !== row.key_prefix) {
        try {
          await db.workspace.updatePublicIdPrefix(
            oldRow.key_prefix,
            row.key_prefix,
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
      const changes = computeChanges(extractEntityFields(oldRow), extractEntityFields(row));

      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'update',
        entityType: 'entity_schema',
        entityId: id,
        entityName: row.name,
        changes
      });

      const enums = await db.catalog.listEnums(ws);
      return toApiSchema(row, entityCount, enums);
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
