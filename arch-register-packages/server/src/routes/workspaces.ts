import { H3, HTTPError, defineHandler } from 'h3';
import sql from '../db/client.js';
import type { Workspace } from '../types.js';
import { logAudit, extractEntityFields, computeChanges } from '../db/audit.js';

const BASE = '/api/workspaces';

type PostgresError = { code: string };

const handleError = (error: unknown, fallback: string): never => {
  if (HTTPError.isError(error)) throw error;
  if (error != null && typeof error === 'object' && 'code' in error) {
    const { code } = error as PostgresError;
    if (code === '23505') {
      throw new HTTPError({
        status: 409,
        statusText: 'Conflict',
        message: 'A workspace with that name already exists'
      });
    }
  }
  throw new HTTPError({ status: 500, statusText: 'Internal Server Error', message: fallback });
};

const slugify = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const shortCode = (name: string): string =>
  name.split(/\s+/).map(w => (w[0] ?? '').toUpperCase()).join('').slice(0, 2);

export function createWorkspaceRoutes() {
  const router = new H3();

  // GET /api/workspaces
  router.get(
    BASE,
    defineHandler(async () => {
      try {
        return await sql<Workspace[]>`SELECT * FROM workspace ORDER BY name`;
      } catch (e) {
        handleError(e, 'Failed to retrieve workspaces');
      }
    })
  );

  // POST /api/workspaces
  router.post(
    BASE,
    defineHandler(async event => {
      const body = await event.req.json().catch(() => undefined);
      if (body == null || typeof body !== 'object')
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'Request body must be a JSON object' });
      const { name, description = '' } = body as Record<string, unknown>;
      if (!name || typeof name !== 'string')
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'name is required and must be a string' });
      const id = slugify(name);
      if (!id)
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'name must contain at least one alphanumeric character' });
      const urlSlug = id;
      const sc = shortCode(name as string);
      try {
        const [row] = await sql<Workspace[]>`
          INSERT INTO workspace (id, name, url_slug, short_code, description)
          VALUES (${id}, ${name}, ${urlSlug}, ${sc}, ${typeof description === 'string' ? description : ''})
          RETURNING *
        `;
        
        // Log audit entry
        await logAudit({
          workspace: row!.id,
          operation: 'create',
          entityType: 'workspace',
          entityId: row!.id,
          entityName: row!.name,
          changes: {
            new: extractEntityFields(row!),
          },
        });
        
        return row!;
      } catch (e) {
        handleError(e, 'Failed to create workspace');
      }
    })
  );

  // PUT /api/workspaces/:id
  router.put(
    `${BASE}/:id`,
    defineHandler(async event => {
      const id = event.context.params?.['id'];
      if (!id) throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'id is required' });
      const body = await event.req.json().catch(() => undefined);
      if (body == null || typeof body !== 'object')
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'Request body must be a JSON object' });
      const { name, description, url_slug, short_code: sc } = body as Record<string, unknown>;
      if (!name || typeof name !== 'string')
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'name is required and must be a string' });
      if (url_slug != null && typeof url_slug === 'string') {
        const cleaned = slugify(url_slug);
        if (!cleaned)
          throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'url_slug must contain at least one alphanumeric character' });
      }
      try {
        // Fetch old state for audit log
        const [oldRow] = await sql<Workspace[]>`
          SELECT * FROM workspace WHERE id = ${id}
        `;
        if (!oldRow) throw new HTTPError({ status: 404, statusText: 'Not Found', message: `Workspace '${id}' not found` });

        const [row] = await sql<Workspace[]>`
          UPDATE workspace SET
            name = ${name},
            url_slug = ${typeof url_slug === 'string' ? slugify(url_slug) : sql`url_slug`},
            short_code = ${typeof sc === 'string' ? sc : sql`short_code`},
            description = ${typeof description === 'string' ? description : sql`description`}
          WHERE id = ${id}
          RETURNING *
        `;
        
        // Log audit entry with field-level changes
        const changes = computeChanges(
          extractEntityFields(oldRow),
          extractEntityFields(row!)
        );
        
        await logAudit({
          workspace: id,
          operation: 'update',
          entityType: 'workspace',
          entityId: id,
          entityName: row!.name,
          changes,
        });
        
        return row!;
      } catch (e) {
        handleError(e, 'Failed to update workspace');
      }
    })
  );

  return router;
}
