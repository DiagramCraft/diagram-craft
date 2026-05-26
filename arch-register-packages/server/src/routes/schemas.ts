import { H3, HTTPError, defineHandler } from 'h3';
import sql from '../db/client.js';
import type { EntitySchema } from '../types.js';
import { logAudit, extractEntityFields, computeChanges } from '../db/audit.js';
import { resolveWorkspace } from './workspace-resolver.js';
import { handlePgError, json } from '../utils/http.js';

const BASE = '/api/:workspace/schemas';

const handleError = (error: unknown, fallback: string): never =>
  handlePgError(error, fallback, {
    '23505': 'A schema with that name already exists in this workspace',
    '23503': 'Cannot delete schema: entities still reference it'
  });


export function createSchemaRoutes() {
  const router = new H3();

  // GET /api/:workspace/schemas
  router.get(
    BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event);
      try {
        return await sql<(EntitySchema & { entity_count: number })[]>`
          SELECT s.*, COALESCE(c.cnt, 0)::int AS entity_count
          FROM entity_schema s
          LEFT JOIN (
            SELECT schema_id, COUNT(*) AS cnt FROM entity WHERE workspace = ${workspace} GROUP BY schema_id
          ) c ON c.schema_id = s.id
          WHERE s.workspace = ${workspace}
          ORDER BY s.name
        `;
      } catch (e) {
        handleError(e, 'Failed to retrieve schemas');
      }
    })
  );

  // GET /api/:workspace/schemas/:id
  router.get(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event);
      const id = event.context.params?.['id'];
      if (!id) throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'id is required' });
      try {
        const [row] = await sql<EntitySchema[]>`
          SELECT * FROM entity_schema WHERE workspace = ${workspace} AND id = ${id}
        `;
        if (!row) throw new HTTPError({ status: 404, statusText: 'Not Found', message: `Schema '${id}' not found` });
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
      const workspace = await resolveWorkspace(event);
      const body = await event.req.json().catch(() => undefined);
      if (body == null || typeof body !== 'object')
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'Request body must be a JSON object' });
      const { name, fields = [], color, icon } = body as Record<string, unknown>;
      if (!name || typeof name !== 'string')
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'name is required and must be a string' });
      const colorVal = typeof color === 'string' ? color : null;
      const iconVal = typeof icon === 'string' ? icon : null;
      try {
        const [row] = await sql<EntitySchema[]>`
          INSERT INTO entity_schema (workspace, name, fields, color, icon)
          VALUES (${workspace}, ${name}, ${json(fields)}, ${colorVal}, ${iconVal})
          RETURNING *
        `;
        
        // Log audit entry
        await logAudit({
          workspace,
          operation: 'create',
          entityType: 'entity_schema',
          entityId: row!.id,
          entityName: row!.name,
          changes: {
            new: extractEntityFields(row!),
          },
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
      const workspace = await resolveWorkspace(event);
      const id = event.context.params?.['id'];
      if (!id) throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'id is required' });
      const body = await event.req.json().catch(() => undefined);
      if (body == null || typeof body !== 'object')
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'Request body must be a JSON object' });
      const { name, fields, color, icon } = body as Record<string, unknown>;
      if (!name || typeof name !== 'string')
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'name is required and must be a string' });
      try {
        // Fetch old state for audit log
        const [oldRow] = await sql<EntitySchema[]>`
          SELECT * FROM entity_schema WHERE workspace = ${workspace} AND id = ${id}
        `;
        if (!oldRow) throw new HTTPError({ status: 404, statusText: 'Not Found', message: `Schema '${id}' not found` });
        
        const [row] = await sql<EntitySchema[]>`
          UPDATE entity_schema SET
            name   = ${name},
            fields = ${fields !== undefined ? json(fields) : sql`fields`},
            color  = ${color !== undefined ? (typeof color === 'string' ? color : null) : sql`color`},
            icon   = ${icon !== undefined ? (typeof icon === 'string' ? icon : null) : sql`icon`}
          WHERE workspace = ${workspace} AND id = ${id}
          RETURNING *
        `;
        
        // Log audit entry with field-level changes
        const changes = computeChanges(
          extractEntityFields(oldRow),
          extractEntityFields(row!)
        );
        
        await logAudit({
          workspace,
          operation: 'update',
          entityType: 'entity_schema',
          entityId: id,
          entityName: row!.name,
          changes,
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
      const workspace = await resolveWorkspace(event);
      const id = event.context.params?.['id'];
      if (!id) throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'id is required' });
      try {
        // Fetch schema before deletion for audit log
        const [schema] = await sql<EntitySchema[]>`
          SELECT * FROM entity_schema WHERE workspace = ${workspace} AND id = ${id}
        `;
        if (!schema) throw new HTTPError({ status: 404, statusText: 'Not Found', message: `Schema '${id}' not found` });
        
        // Delete schema
        await sql`DELETE FROM entity_schema WHERE workspace = ${workspace} AND id = ${id}`;
        
        // Log audit entry
        await logAudit({
          workspace,
          operation: 'delete',
          entityType: 'entity_schema',
          entityId: id,
          entityName: schema.name,
          changes: {
            old: extractEntityFields(schema),
          },
        });
        
        return { success: true, message: `Schema '${id}' deleted` };
      } catch (e) {
        handleError(e, 'Failed to delete schema');
      }
    })
  );

  return router;
}
