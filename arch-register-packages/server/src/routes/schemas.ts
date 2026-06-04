import { H3, defineHandler } from 'h3';
import { newid } from '@diagram-craft/utils/id';
import type { DatabaseAdapter } from '../db/database.js';
import type { EntitySchema } from '../types.js';
import { logAudit, extractEntityFields, computeChanges } from '../db/audit.js';
import { resolveWorkspace } from './workspace-resolver.js';
import { handleDbError } from '../utils/http.js';
import { buildApiAuthCtx, requireWorkspaceCapability } from '../auth/authorization.js';
import type { AuthenticatedEvent } from '../middleware/auth.js';
import { httpAssert } from '../utils/httpAssert.js';
import { toApiSchema } from '../api/transforms.js';

const BASE = '/api/:workspace/schemas';

const handleError = (error: unknown, fallback: string): never =>
  handleDbError(error, fallback, {
    unique: 'A schema with that name already exists in this workspace',
    foreign: 'Cannot delete schema: entities still reference it'
  });

export function createSchemaRoutes(db: DatabaseAdapter) {
  const router = new H3();

  router.get(
    BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
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
      const workspace = await resolveWorkspace(event, db);
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
        return toApiSchema(
          row,
          entities.filter(entity => entity.schema_id === id).length,
          enums
        );
      } catch (e) {
        handleError(e, 'Failed to retrieve schema');
      }
    })
  );

  router.post(
    BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'schema.edit');
      const body = await event.req.json().catch(() => undefined);
      httpAssert.json(body, { message: 'Request body must be a JSON object' });
      const { name, description = '', fields = [], color, icon, default_owner } = body as Record<string, unknown>;
      httpAssert.string(name, { message: 'name is required and must be a string' });
      const colorVal = typeof color === 'string' ? color : null;
      const iconVal = typeof icon === 'string' ? icon : null;
      const teamIds = new Set(
        (await db.workspaceAdmin.listTeams(workspace)).map(owner => owner.id)
      );
      const defaultOwner =
        typeof default_owner === 'string' && teamIds.has(default_owner) ? default_owner : null;
      try {
        const timestamp = new Date();
        const row = await db.catalog.createSchema({
          id: newid(),
          workspace,
          name: name as string,
          description: typeof description === 'string' ? description : '',
          fields: Array.isArray(fields) ? (fields as EntitySchema['fields']) : [],
          color: colorVal,
          icon: iconVal,
          default_owner: defaultOwner,
          created_at: timestamp,
          updated_at: timestamp
        });

        await logAudit(db, {
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
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'schema.edit');
      const id = event.context.params?.['id'];
      httpAssert.string(id, { message: 'id is required' });
      const body = await event.req.json().catch(() => undefined);
      httpAssert.json(body, { message: 'Request body must be a JSON object' });
      const { name, description, fields, color, icon, default_owner } = body as Record<string, unknown>;
      httpAssert.string(name, { message: 'name is required and must be a string' });
      const teamIds = new Set(
        (await db.workspaceAdmin.listTeams(workspace)).map(owner => owner.id)
      );
      try {
        const oldRow = await db.catalog.getSchema(workspace, id);
        httpAssert.present(oldRow, { status: 404, message: `Schema '${id}' not found` });

        const row = await db.catalog.updateSchema(workspace, id, {
          name: name as string,
          description: description !== undefined ? (typeof description === 'string' ? description : '') : oldRow.description,
          fields:
            fields !== undefined && Array.isArray(fields)
              ? (fields as EntitySchema['fields'])
              : oldRow.fields,
          color: color !== undefined ? (typeof color === 'string' ? color : null) : oldRow.color,
          icon: icon !== undefined ? (typeof icon === 'string' ? icon : null) : oldRow.icon,
          default_owner:
            default_owner !== undefined
              ? typeof default_owner === 'string' && teamIds.has(default_owner)
                ? default_owner
                : null
              : oldRow.default_owner,
          updated_at: new Date()
        });

        const changes = computeChanges(extractEntityFields(oldRow), extractEntityFields(row!));

        await logAudit(db, {
          workspace,
          operation: 'update',
          entityType: 'entity_schema',
          entityId: id,
          entityName: row!.name,
          changes
        });

        const [entities, enums] = await Promise.all([
          db.catalog.listEntities(workspace),
          db.catalog.listEnums(workspace)
        ]);
        return toApiSchema(
          row!,
          entities.filter(entity => entity.schema_id === id).length,
          enums
        );
      } catch (e) {
        handleError(e, 'Failed to update schema');
      }
    })
  );

  router.delete(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'schema.edit');
      const id = event.context.params?.['id'];
      httpAssert.string(id, { message: 'id is required' });
      try {
        const schema = await db.catalog.getSchema(workspace, id);
        httpAssert.present(schema, { status: 404, message: `Schema '${id}' not found` });

        await db.catalog.deleteSchema(workspace, id);

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
