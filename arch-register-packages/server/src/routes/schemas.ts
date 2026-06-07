import { H3, defineHandler, HTTPError } from 'h3';
import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../db/database';
import type { EntitySchema } from '../types.js';
import { logAudit, extractEntityFields, computeChanges } from '../db/audit.js';
import { resolveWorkspace } from '../api-helpers/resolveWorkspace.js';
import { handleDbError } from '../utils/http.js';
import { buildApiAuthCtx, requireWorkspaceCapability } from '../auth/authorization.js';
import type { AuthenticatedEvent } from '../middleware/auth.js';
import { httpAssert } from '../utils/httpAssert.js';
import { toApiSchema } from '../api-helpers/schema-helpers.js';

const BASE = '/api/:workspace/schemas';

const handleError = (error: unknown, fallback: string): never =>
  handleDbError(error, fallback, {
    unique: 'A schema with that name already exists in this workspace',
    foreign: 'Cannot delete schema: entities still reference it'
  });

type SchemaMutationPayload = {
  name: string;
  description: string;
  fields: EntitySchema['fields'];
  color: string | null;
  icon: string | null;
  defaultOwner: string | null;
};

export const resolveSchemaDefaultOwner = (
  requestedOwner: unknown,
  teamIds: Set<string>,
  fallbackOwner: string | null = null
) =>
  typeof requestedOwner === 'string' && teamIds.has(requestedOwner)
    ? requestedOwner
    : fallbackOwner;

export const buildCreateSchemaInput = (
  workspace: string,
  body: Record<string, unknown>,
  teamIds: Set<string>,
  timestamp: Date,
  idFactory: () => string = randomUUID
) => {
  const { name, description = '', fields = [], color, icon, default_owner } = body;
  httpAssert.string(name, { message: 'name is required and must be a string' });

  return {
    id: idFactory(),
    workspace,
    name,
    description: typeof description === 'string' ? description : '',
    fields: Array.isArray(fields) ? (fields as EntitySchema['fields']) : [],
    color: typeof color === 'string' ? color : null,
    icon: typeof icon === 'string' ? icon : null,
    default_owner: resolveSchemaDefaultOwner(default_owner, teamIds, null),
    created_at: timestamp,
    updated_at: timestamp
  };
};

export const buildUpdateSchemaInput = (
  body: Record<string, unknown>,
  current: EntitySchema,
  teamIds: Set<string>,
  timestamp: Date
): SchemaMutationPayload & { updated_at: Date } => {
  const { name, description, fields, color, icon, default_owner } = body;
  httpAssert.string(name, { message: 'name is required and must be a string' });

  return {
    name,
    description:
      description !== undefined
        ? typeof description === 'string'
          ? description
          : ''
        : current.description,
    fields:
      fields !== undefined && Array.isArray(fields)
        ? (fields as EntitySchema['fields'])
        : current.fields,
    color: color !== undefined ? (typeof color === 'string' ? color : null) : current.color,
    icon: icon !== undefined ? (typeof icon === 'string' ? icon : null) : current.icon,
    defaultOwner:
      default_owner !== undefined
        ? resolveSchemaDefaultOwner(default_owner, teamIds, null)
        : current.default_owner,
    updated_at: timestamp
  };
};

export const isSchemaReferencedByEntities = (
  schemaId: string,
  entities: Array<{ schema_id: string }>
) => entities.some(entity => entity.schema_id === schemaId);

export function createSchemaRoutes(db: DatabaseAdapter) {
  const router = new H3();

  router.get(
    BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.view');
      try {
        const [schemas, entities, enums] = await Promise.all([
          db.catalog.listSchemas(workspace),
          db.catalog.listEntities(workspace),
          db.catalog.listEnums(workspace)
        ]);
        return schemas.map(schema =>
          toApiSchema(
            schema,
            entities.filter(entity => entity.schema_id === schema.id).length,
            enums
          )
        );
      } catch (e) {
        handleError(e, 'Failed to retrieve schemas');
      }
    })
  );

  router.get(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.view');
      const id = event.context.params?.['id'];
      httpAssert.string(id, { message: 'id is required' });
      try {
        const [row, entities, enums] = await Promise.all([
          db.catalog.getSchema(workspace, id),
          db.catalog.listEntities(workspace),
          db.catalog.listEnums(workspace)
        ]);
        httpAssert.present(row, { status: 404, message: `Schema '${id}' not found` });
        return toApiSchema(row, entities.filter(entity => entity.schema_id === id).length, enums);
      } catch (e) {
        handleError(e, 'Failed to retrieve schema');
      }
    })
  );

  router.post(
    BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'schema.edit');
      const body = await event.req.json().catch(() => undefined);
      httpAssert.json(body, { message: 'Request body must be a JSON object' });
      const teamIds = new Set(
        (await db.workspaceAdmin.listTeams(workspace)).map(owner => owner.id)
      );
      try {
        const timestamp = new Date();
        const row = await db.catalog.createSchema(
          buildCreateSchemaInput(workspace, body as Record<string, unknown>, teamIds, timestamp)
        );

        await logAudit(db.audit, {
          workspace,
          operation: 'create',
          entityType: 'entity_schema',
          entityId: row.id,
          entityName: row.name,
          changes: {
            new: extractEntityFields(row)
          }
        });

        const enums = await db.catalog.listEnums(workspace);
        return toApiSchema(row, 0, enums);
      } catch (e) {
        handleError(e, 'Failed to create schema');
      }
    })
  );

  router.put(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'schema.edit');
      const id = event.context.params?.['id'];
      httpAssert.string(id, { message: 'id is required' });
      const body = await event.req.json().catch(() => undefined);
      httpAssert.json(body, { message: 'Request body must be a JSON object' });
      const teamIds = new Set(
        (await db.workspaceAdmin.listTeams(workspace)).map(owner => owner.id)
      );
      try {
        const oldRow = await db.catalog.getSchema(workspace, id);
        httpAssert.present(oldRow, { status: 404, message: `Schema '${id}' not found` });

        const next = buildUpdateSchemaInput(
          body as Record<string, unknown>,
          oldRow,
          teamIds,
          new Date()
        );
        const row = await db.catalog.updateSchema(workspace, id, {
          name: next.name,
          description: next.description,
          fields: next.fields,
          color: next.color,
          icon: next.icon,
          default_owner: next.defaultOwner,
          updated_at: next.updated_at
        });

        httpAssert.present(row, { status: 404, message: `Schema '${id}' not found` });
        const changes = computeChanges(extractEntityFields(oldRow), extractEntityFields(row));

        await logAudit(db.audit, {
          workspace,
          operation: 'update',
          entityType: 'entity_schema',
          entityId: id,
          entityName: row.name,
          changes
        });

        const [entities, enums] = await Promise.all([
          db.catalog.listEntities(workspace),
          db.catalog.listEnums(workspace)
        ]);
        return toApiSchema(row, entities.filter(entity => entity.schema_id === id).length, enums);
      } catch (e) {
        handleError(e, 'Failed to update schema');
      }
    })
  );

  router.delete(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'schema.edit');
      const id = event.context.params?.['id'];
      httpAssert.string(id, { message: 'id is required' });
      try {
        const schema = await db.catalog.getSchema(workspace, id);
        httpAssert.present(schema, { status: 404, message: `Schema '${id}' not found` });
        const entities = await db.catalog.listEntities(workspace);
        if (isSchemaReferencedByEntities(id, entities)) {
          throw new HTTPError({
            status: 409,
            statusText: 'Conflict',
            message: 'Cannot delete schema: entities still reference it'
          });
        }

        await db.catalog.deleteSchema(workspace, id);

        await logAudit(db.audit, {
          workspace,
          operation: 'delete',
          entityType: 'entity_schema',
          entityId: id,
          entityName: schema.name,
          changes: {
            old: extractEntityFields(schema)
          }
        });

        return { success: true, message: `Schema '${id}' deleted` };
      } catch (e) {
        handleError(e, 'Failed to delete schema');
      }
    })
  );

  return router;
}
