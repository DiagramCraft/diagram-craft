import { H3, HTTPError, defineHandler } from 'h3';
import sql from '../db/client.js';
import type { EntitySchema } from '../types.js';

const BASE = '/api/schemas';

// body is already parsed JSON; cast is safe but needed because postgres's JSONValue type
// is more restrictive than the `unknown` we get from readBody.
const json = (v: unknown) => sql.json(v as Parameters<typeof sql.json>[0]);

type PostgresError = { code: string };

const handleError = (error: unknown, fallback: string): never => {
  if (HTTPError.isError(error)) throw error;
  if (error != null && typeof error === 'object' && 'code' in error) {
    const { code } = error as PostgresError;
    if (code === '23505') {
      throw new HTTPError({ status: 409, statusText: 'Conflict', message: 'A schema with that name already exists' });
    }
    if (code === '23503') {
      throw new HTTPError({ status: 409, statusText: 'Conflict', message: 'Cannot delete schema: entities still reference it' });
    }
  }
  throw new HTTPError({ status: 500, statusText: 'Internal Server Error', message: fallback });
};

export function createSchemaRoutes() {
  const router = new H3();

  // GET /api/schemas
  router.get(
    BASE,
    defineHandler(async () => {
      try {
        return await sql<EntitySchema[]>`SELECT * FROM entity_schema ORDER BY name`;
      } catch (e) {
        handleError(e, 'Failed to retrieve schemas');
      }
    })
  );

  // GET /api/schemas/:id
  router.get(
    `${BASE}/:id`,
    defineHandler(async event => {
      const id = event.context.params?.['id'];
      if (!id) throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'id is required' });
      try {
        const [row] = await sql<EntitySchema[]>`SELECT * FROM entity_schema WHERE id = ${id}`;
        if (!row) throw new HTTPError({ status: 404, statusText: 'Not Found', message: `Schema '${id}' not found` });
        return row;
      } catch (e) {
        handleError(e, 'Failed to retrieve schema');
      }
    })
  );

  // POST /api/schemas
  router.post(
    BASE,
    defineHandler(async event => {
      const body = await event.req.json().catch(() => undefined);
      if (body == null || typeof body !== 'object')
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'Request body must be a JSON object' });
      const { name, fields = [] } = body as Record<string, unknown>;
      if (!name || typeof name !== 'string')
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'name is required and must be a string' });
      try {
        const [row] = await sql<EntitySchema[]>`
          INSERT INTO entity_schema (name, fields)
          VALUES (${name}, ${json(fields)})
          RETURNING *
        `;
        return row!;
      } catch (e) {
        handleError(e, 'Failed to create schema');
      }
    })
  );

  // PUT /api/schemas/:id
  router.put(
    `${BASE}/:id`,
    defineHandler(async event => {
      const id = event.context.params?.['id'];
      if (!id) throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'id is required' });
      const body = await event.req.json().catch(() => undefined);
      if (body == null || typeof body !== 'object')
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'Request body must be a JSON object' });
      const { name, fields } = body as Record<string, unknown>;
      if (!name || typeof name !== 'string')
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'name is required and must be a string' });
      try {
        const [row] = await sql<EntitySchema[]>`
          UPDATE entity_schema SET
            name   = ${name},
            fields = ${fields !== undefined ? json(fields) : sql`fields`}
          WHERE id = ${id}
          RETURNING *
        `;
        if (!row) throw new HTTPError({ status: 404, statusText: 'Not Found', message: `Schema '${id}' not found` });
        return row;
      } catch (e) {
        handleError(e, 'Failed to update schema');
      }
    })
  );

  // DELETE /api/schemas/:id
  router.delete(
    `${BASE}/:id`,
    defineHandler(async event => {
      const id = event.context.params?.['id'];
      if (!id) throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'id is required' });
      try {
        const [row] = await sql<EntitySchema[]>`DELETE FROM entity_schema WHERE id = ${id} RETURNING id`;
        if (!row) throw new HTTPError({ status: 404, statusText: 'Not Found', message: `Schema '${id}' not found` });
        return { success: true, message: `Schema '${id}' deleted` };
      } catch (e) {
        handleError(e, 'Failed to delete schema');
      }
    })
  );

  return router;
}
