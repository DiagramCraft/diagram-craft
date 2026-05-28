import { H3, HTTPError, defineHandler } from 'h3';
import type { DatabaseAdapter } from '../db/database.js';
import type { EntitySchema } from '../types.js';
import { logAudit, extractEntityFields, computeChanges } from '../db/audit.js';
import { resolveWorkspace } from './workspace-resolver.js';
import { handleDbError } from '../utils/http.js';
import { buildApiAuthCtx, requireGlobalPermission } from '../auth/authorization.js';
import type { AuthenticatedEvent } from '../middleware/auth.js';

const BASE = '/api/:workspace/schemas';

const handleError = (error: unknown, fallback: string): never =>
  handleDbError(error, fallback, {
    unique: 'A schema with that name already exists in this workspace',
    foreign: 'Cannot delete schema: entities still reference it'
  });

export function createSchemaRoutes(db: DatabaseAdapter) {
  const router = new H3();

  // GET /api/:workspace/schemas
  router.get(
    BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      if (authCtx) requireGlobalPermission(authCtx, 'view_schema');
      try {
        const [schemas, entities] = await Promise.all([
          db.listSchemas(workspace),
          db.listEntities(workspace)
        ]);
        return schemas.map(schema => ({
          ...schema,
          entity_count: entities.filter(entity => entity.schema_id === schema.id).length
        }));
      } catch (e) {
        handleError(e, 'Failed to retrieve schemas');
      }
    })
  );

  // GET /api/:workspace/schemas/:id
  router.get(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      if (authCtx) requireGlobalPermission(authCtx, 'view_schema');
      const id = event.context.params?.['id'];
      if (!id)
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'id is required' });
      try {
        const row = await db.getSchema(workspace, id);
        if (!row)
          throw new HTTPError({
            status: 404,
            statusText: 'Not Found',
            message: `Schema '${id}' not found`
          });
        return row;
      } catch (e) {
        handleError(e, 'Failed to retrieve schema');
      }
    })
  );

  // POST /api/:workspace/schemas
  router.post(
    BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      if (authCtx) requireGlobalPermission(authCtx, 'edit_schema');
      const body = await event.req.json().catch(() => undefined);
      if (body == null || typeof body !== 'object')
        throw new HTTPError({
          status: 400,
          statusText: 'Bad Request',
          message: 'Request body must be a JSON object'
        });
      const { name, fields = [], color, icon, default_owner } = body as Record<string, unknown>;
      if (!name || typeof name !== 'string')
        throw new HTTPError({
          status: 400,
          statusText: 'Bad Request',
          message: 'name is required and must be a string'
        });
      const colorVal = typeof color === 'string' ? color : null;
      const iconVal = typeof icon === 'string' ? icon : null;
      const ownerValues = new Set((await db.listOwners(workspace)).map(owner => owner.id));
      const defaultOwner =
        typeof default_owner === 'string' && ownerValues.has(default_owner) ? default_owner : null;
      try {
        const timestamp = new Date();
        const row = await db.createSchema({
          id: crypto.randomUUID(),
          workspace,
          name: name as string,
          fields: Array.isArray(fields) ? (fields as EntitySchema['fields']) : [],
          color: colorVal,
          icon: iconVal,
          default_owner: defaultOwner,
          created_at: timestamp,
          updated_at: timestamp
        });

        // Log audit entry
        await logAudit(db, {
          workspace,
          operation: 'create',
          entityType: 'entity_schema',
          entityId: row!.id,
          entityName: row!.name,
          changes: {
            new: extractEntityFields(row!)
          }
        });

        return row!;
      } catch (e) {
        handleError(e, 'Failed to create schema');
      }
    })
  );

  // PUT /api/:workspace/schemas/:id
  router.put(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      if (authCtx) requireGlobalPermission(authCtx, 'edit_schema');
      const id = event.context.params?.['id'];
      if (!id)
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'id is required' });
      const body = await event.req.json().catch(() => undefined);
      if (body == null || typeof body !== 'object')
        throw new HTTPError({
          status: 400,
          statusText: 'Bad Request',
          message: 'Request body must be a JSON object'
        });
      const { name, fields, color, icon, default_owner } = body as Record<string, unknown>;
      if (!name || typeof name !== 'string')
        throw new HTTPError({
          status: 400,
          statusText: 'Bad Request',
          message: 'name is required and must be a string'
        });
      const ownerValues = new Set((await db.listOwners(workspace)).map(owner => owner.id));
      try {
        // Fetch old state for audit log
        const oldRow = await db.getSchema(workspace, id);
        if (!oldRow)
          throw new HTTPError({
            status: 404,
            statusText: 'Not Found',
            message: `Schema '${id}' not found`
          });

        const row = await db.updateSchema(workspace, id, {
          name: name as string,
          fields:
            fields !== undefined && Array.isArray(fields)
              ? (fields as EntitySchema['fields'])
              : oldRow.fields,
          color: color !== undefined ? (typeof color === 'string' ? color : null) : oldRow.color,
          icon: icon !== undefined ? (typeof icon === 'string' ? icon : null) : oldRow.icon,
          default_owner:
            default_owner !== undefined
              ? typeof default_owner === 'string' && ownerValues.has(default_owner)
                ? default_owner
                : null
              : oldRow.default_owner,
          updated_at: new Date()
        });

        // Log audit entry with field-level changes
        const changes = computeChanges(extractEntityFields(oldRow), extractEntityFields(row!));

        await logAudit(db, {
          workspace,
          operation: 'update',
          entityType: 'entity_schema',
          entityId: id,
          entityName: row!.name,
          changes
        });

        return row!;
      } catch (e) {
        handleError(e, 'Failed to update schema');
      }
    })
  );

  // DELETE /api/:workspace/schemas/:id
  router.delete(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      if (authCtx) requireGlobalPermission(authCtx, 'edit_schema');
      const id = event.context.params?.['id'];
      if (!id)
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'id is required' });
      try {
        // Fetch schema before deletion for audit log
        const schema = await db.getSchema(workspace, id);
        if (!schema)
          throw new HTTPError({
            status: 404,
            statusText: 'Not Found',
            message: `Schema '${id}' not found`
          });

        // Delete schema
        await db.deleteSchema(workspace, id);

        // Log audit entry
        await logAudit(db, {
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
