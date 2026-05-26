import { H3, HTTPError, defineHandler } from 'h3';
import sql from '../db/client.js';
import type { Workspace } from '../types.js';

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
      try {
        const [row] = await sql<Workspace[]>`
          INSERT INTO workspace (id, name, description)
          VALUES (${id}, ${name}, ${typeof description === 'string' ? description : ''})
          RETURNING *
        `;
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
      const { name, description } = body as Record<string, unknown>;
      if (!name || typeof name !== 'string')
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'name is required and must be a string' });
      try {
        const [row] = await sql<Workspace[]>`
          UPDATE workspace SET
            name = ${name},
            description = ${typeof description === 'string' ? description : sql`description`}
          WHERE id = ${id}
          RETURNING *
        `;
        if (!row) throw new HTTPError({ status: 404, statusText: 'Not Found', message: `Workspace '${id}' not found` });
        return row;
      } catch (e) {
        handleError(e, 'Failed to update workspace');
      }
    })
  );

  return router;
}
