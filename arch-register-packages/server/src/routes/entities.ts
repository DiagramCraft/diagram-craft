import { createError, createRouter, defineEventHandler, getQuery, readBody } from 'h3';
import sql from '../db/client.js';

const BASE = '/api/entities';

type EntityRow = {
  id: string;
  name: string;
  schema_id: string;
  data: unknown;
  created_at: Date;
  updated_at: Date;
};

type PostgresError = { code: string };

const handleError = (error: unknown, fallback: string): never => {
  if (error != null && typeof error === 'object' && 'statusCode' in error) throw error;
  if (error != null && typeof error === 'object' && 'code' in error) {
    const { code } = error as PostgresError;
    if (code === '23503') {
      throw createError({
        status: 400,
        statusMessage: 'Bad Request',
        data: { message: 'schema_id references a schema that does not exist' }
      });
    }
  }
  throw createError({ status: 500, statusMessage: 'Internal Server Error', data: { message: fallback } });
};

export function createEntityRoutes() {
  const router = createRouter();

  // GET /api/entities[?schema_id=...]
  router.get(
    BASE,
    defineEventHandler(async event => {
      const { schema_id } = getQuery(event);
      try {
        if (schema_id && typeof schema_id === 'string') {
          return await sql<EntityRow[]>`SELECT * FROM entity WHERE schema_id = ${schema_id} ORDER BY name`;
        }
        return await sql<EntityRow[]>`SELECT * FROM entity ORDER BY name`;
      } catch (e) {
        handleError(e, 'Failed to retrieve entities');
      }
    })
  );

  // GET /api/entities/:id
  router.get(
    `${BASE}/:id`,
    defineEventHandler(async event => {
      const id = event.context.params?.['id'];
      if (!id) throw createError({ status: 400, statusMessage: 'Bad Request', data: { message: 'id is required' } });
      try {
        const [row] = await sql<EntityRow[]>`SELECT * FROM entity WHERE id = ${id}`;
        if (!row) throw createError({ status: 404, statusMessage: 'Not Found', data: { message: `Entity '${id}' not found` } });
        return row;
      } catch (e) {
        handleError(e, 'Failed to retrieve entity');
      }
    })
  );

  // POST /api/entities
  router.post(
    BASE,
    defineEventHandler(async event => {
      const body = await readBody(event);
      if (body == null || typeof body !== 'object')
        throw createError({ status: 400, statusMessage: 'Bad Request', data: { message: 'Request body must be a JSON object' } });
      const { name, schema_id, data = {} } = body as Record<string, unknown>;
      if (!name || typeof name !== 'string')
        throw createError({ status: 400, statusMessage: 'Bad Request', data: { message: 'name is required and must be a string' } });
      if (!schema_id || typeof schema_id !== 'string')
        throw createError({ status: 400, statusMessage: 'Bad Request', data: { message: 'schema_id is required and must be a string (UUID)' } });
      try {
        const [row] = await sql<EntityRow[]>`
          INSERT INTO entity (name, schema_id, data)
          VALUES (${name}, ${schema_id}, ${sql.json(data)})
          RETURNING *
        `;
        return row;
      } catch (e) {
        handleError(e, 'Failed to create entity');
      }
    })
  );

  // PUT /api/entities/:id
  router.put(
    `${BASE}/:id`,
    defineEventHandler(async event => {
      const id = event.context.params?.['id'];
      if (!id) throw createError({ status: 400, statusMessage: 'Bad Request', data: { message: 'id is required' } });
      const body = await readBody(event);
      if (body == null || typeof body !== 'object')
        throw createError({ status: 400, statusMessage: 'Bad Request', data: { message: 'Request body must be a JSON object' } });
      const { name, schema_id, data } = body as Record<string, unknown>;
      if (!name || typeof name !== 'string')
        throw createError({ status: 400, statusMessage: 'Bad Request', data: { message: 'name is required and must be a string' } });
      if (!schema_id || typeof schema_id !== 'string')
        throw createError({ status: 400, statusMessage: 'Bad Request', data: { message: 'schema_id is required and must be a string (UUID)' } });
      try {
        const [row] = await sql<EntityRow[]>`
          UPDATE entity SET
            name      = ${name},
            schema_id = ${schema_id},
            data      = ${data !== undefined ? sql.json(data) : sql`data`}
          WHERE id = ${id}
          RETURNING *
        `;
        if (!row) throw createError({ status: 404, statusMessage: 'Not Found', data: { message: `Entity '${id}' not found` } });
        return row;
      } catch (e) {
        handleError(e, 'Failed to update entity');
      }
    })
  );

  // DELETE /api/entities/:id
  router.delete(
    `${BASE}/:id`,
    defineEventHandler(async event => {
      const id = event.context.params?.['id'];
      if (!id) throw createError({ status: 400, statusMessage: 'Bad Request', data: { message: 'id is required' } });
      try {
        const [row] = await sql<EntityRow[]>`DELETE FROM entity WHERE id = ${id} RETURNING id`;
        if (!row) throw createError({ status: 404, statusMessage: 'Not Found', data: { message: `Entity '${id}' not found` } });
        return { success: true, message: `Entity '${id}' deleted` };
      } catch (e) {
        handleError(e, 'Failed to delete entity');
      }
    })
  );

  return router;
}
