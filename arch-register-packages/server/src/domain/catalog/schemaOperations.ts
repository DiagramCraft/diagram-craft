import type { DatabaseAdapter } from '../../db/database';
import { logAudit, extractEntityFields, computeChanges } from '../audit/db/auditLogging';
import { handleDbError } from '../../utils/http';
import { httpAssert } from '../../utils/httpAssert';
import { countEntities } from './entityOperations';
import {
  toApiSchema,
  buildCreateSchemaInput,
  buildUpdateSchemaInput
} from './schemaHelpers';
import { EntitySchema } from '@arch-register/api-types/schemaContract';

const handleError = (error: unknown, fallback: string): never =>
  handleDbError(error, fallback, {
    unique: 'A schema with that name already exists in this workspace',
    foreign: 'Cannot delete schema: entities still reference it'
  });

export const listWorkspaceSchemas = async (
  db: DatabaseAdapter,
  workspace: string
): Promise<EntitySchema[]> => {
  try {
    const [schemas, enums] = await Promise.all([
      db.catalog.listSchemas(workspace),
      db.catalog.listEnums(workspace)
    ]);
    const counts = await Promise.all(
      schemas.map(schema =>
        countEntities(db, workspace, null, {
          schemaId: schema.id
        })
      )
    );
    return schemas.map((schema, index) => toApiSchema(schema, counts[index] ?? 0, enums));
  } catch (error) {
    return handleError(error, 'Failed to retrieve schemas');
  }
};

export const getWorkspaceSchema = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string
): Promise<EntitySchema> => {
  try {
    const [row, enums] = await Promise.all([
      db.catalog.getSchema(workspace, id),
      db.catalog.listEnums(workspace)
    ]);
    httpAssert.present(row, { status: 404, message: `Schema '${id}' not found` });
    const entityCount = await countEntities(db, workspace, null, {
      schemaId: id
    });
    return toApiSchema(row, entityCount, enums);
  } catch (error) {
    return handleError(error, 'Failed to retrieve schema');
  }
};

export const createWorkspaceSchema = async (
  db: DatabaseAdapter,
  workspace: string,
  body: Record<string, unknown>,
  userId: string
): Promise<EntitySchema> => {
  try {
    const teamIds = new Set((await db.workspace.listTeams(workspace)).map(owner => owner.id));
    const timestamp = new Date();
    const row = await db.catalog.createSchema(buildCreateSchemaInput(workspace, body, teamIds, timestamp));
    httpAssert.present(row.key_prefix, { status: 409, message: `Schema '${row.id}' is missing a key prefix` });
    await db.workspace.registerPublicIdPrefix(row.key_prefix, 'schema', row.id, timestamp);

    await logAudit(db, {
      userId,
      workspace,
      operation: 'create',
      entityType: 'entity_schema',
      entityId: row.id,
      entityName: row.name,
      changes: { new: extractEntityFields(row) }
    });

    const enums = await db.catalog.listEnums(workspace);
    return toApiSchema(row, 0, enums);
  } catch (error) {
    return handleError(error, 'Failed to create schema');
  }
};

export const updateWorkspaceSchema = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  body: Record<string, unknown>,
  userId: string
): Promise<EntitySchema> => {
  try {
    const oldRow = await db.catalog.getSchema(workspace, id);
    httpAssert.present(oldRow, { status: 404, message: `Schema '${id}' not found` });

    const teamIds = new Set((await db.workspace.listTeams(workspace)).map(owner => owner.id));
    const next = buildUpdateSchemaInput(body, oldRow, teamIds, new Date());
    const row = await db.catalog.updateSchema(workspace, id, {
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
        await db.workspace.updatePublicIdPrefix(oldRow.key_prefix, row.key_prefix, 'schema', id, next.updated_at);
      } catch (error) {
        handleDbError(error, 'Failed to update key prefix', {
          unique: 'A schema with that key prefix already exists'
        });
      }
    }
    const changes = computeChanges(extractEntityFields(oldRow), extractEntityFields(row));

    await logAudit(db, {
      userId,
      workspace,
      operation: 'update',
      entityType: 'entity_schema',
      entityId: id,
      entityName: row.name,
      changes
    });

    const [entityCount, enums] = await Promise.all([
      countEntities(db, workspace, null, {
        schemaId: id
      }),
      db.catalog.listEnums(workspace)
    ]);
    return toApiSchema(row, entityCount, enums);
  } catch (error) {
    return handleError(error, 'Failed to update schema');
  }
};

export const deleteWorkspaceSchema = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  userId: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const schema = await db.catalog.getSchema(workspace, id);
    httpAssert.present(schema, { status: 404, message: `Schema '${id}' not found` });

    const entityCount = await countEntities(db, workspace, null, {
      schemaId: id
    });
    httpAssert.true(entityCount === 0, {
      status: 409,
      message: 'Cannot delete schema: entities still reference it'
    });

    await db.catalog.deleteSchema(workspace, id);
    if (schema.key_prefix) {
      await db.workspace.deletePublicIdPrefix(schema.key_prefix);
    }

    await logAudit(db, {
      userId,
      workspace,
      operation: 'delete',
      entityType: 'entity_schema',
      entityId: id,
      entityName: schema.name,
      changes: { old: extractEntityFields(schema) }
    });

    return { success: true, message: `Schema '${id}' deleted` };
  } catch (error) {
    return handleError(error, 'Failed to delete schema');
  }
};
