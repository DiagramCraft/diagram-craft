import { createError, createRouter, defineEventHandler, readBody } from 'h3';
import sql from '../db/client.js';

const BASE = '/api/entity-schemas';

type EntitySchemaRow = {
  id: string;
  name: string;
  fields: unknown;
  created_at: Date;
  updated_at: Date;
};

type PostgresError = { code: string };

const handleError = (error: unknown, fallback: string): never => {
  if (error != null && typeof error === 'object' && 'statusCode' in error) throw error;
  if (error != null && typeof error === 'object' && 'code' in error) {
    const { code } = error as PostgresError;
    if (code === '23505') {
      throw createError({
        status: 409,
        statusMessage: 'Conflict',
        data: { message: 'An entity schema with that name already exists' }
      });
    }
    if (code === '23503') {
      throw createError({
        status: 409,
        statusMessage: 'Conflict',
        data: { message: 'Cannot delete schema: entities still reference it' }
      });
    }
  }
  throw createError({ status: 500, statusMessage: 'Internal Server Error', data: { message: fallback } });
};

export function createEntitySchemaRoutes() {
  const router = createRouter();

  // GET /api/entity-schemas
  router.get(
    BASE,
    defineEventHandler(async () => {
      try {
        return await sql<EntitySchemaRow[]>`SELECT * FROM entity_schema ORDER BY name`;
      } catch (e) {
        handleError(e, 'Failed to retrieve entity schemas');
      }
    })
  );

  // GET /api/entity-schemas/:id
  router.get(
    `${BASE}/:id`,
    defineEventHandler(async event => {
      const id = event.context.params?.['id'];
      if (!id) throw createError({ status: 400, statusMessage: 'Bad Request', data: { message: 'id is required' } });
      try {
        const [row] = await sql<EntitySchemaRow[]>`SELECT * FROM entity_schema WHERE id = ${id}`;
        if (!row)
          throw createError({ status: 404, statusMessage: 'Not Found', data: { message: `Entity schema '${id}' not found` } });
        return row;
      } catch (e) {
        handleError(e, 'Failed to retrieve entity schema');
      }
    })
  );

  // POST /api/entity-schemas
  router.post(
    BASE,
    defineEventHandler(async event => {
      const body = await readBody(event);
      if (body == null || typeof body !== 'object')
        throw createError({ status: 400, statusMessage: 'Bad Request', data: { message: 'Request body must be a JSON object' } });
      const { name, fields = [] } = body as Record<string, unknown>;
      if (!name || typeof name !== 'string')
        throw createError({ status: 400, statusMessage: 'Bad Request', data: { message: 'name is required and must be a string' } });
      try {
        const [row] = await sql<EntitySchemaRow[]>`
          INSERT INTO entity_schema (name, fields)
          VALUES (${name}, ${sql.json(fields)})
          RETURNING *
        `;
        return row;
      } catch (e) {
        handleError(e, 'Failed to create entity schema');
      }
    })
  );

  // PUT /api/entity-schemas/:id
  router.put(
    `${BASE}/:id`,
    defineEventHandler(async event => {
      const id = event.context.params?.['id'];
      if (!id) throw createError({ status: 400, statusMessage: 'Bad Request', data: { message: 'id is required' } });
      const body = await readBody(event);
      if (body == null || typeof body !== 'object')
        throw createError({ status: 400, statusMessage: 'Bad Request', data: { message: 'Request body must be a JSON object' } });
      const { name, fields } = body as Record<string, unknown>;
      if (!name || typeof name !== 'string')
        throw createError({ status: 400, statusMessage: 'Bad Request', data: { message: 'name is required and must be a string' } });
      try {
        const [row] = await sql<EntitySchemaRow[]>`
          UPDATE entity_schema SET
            name   = ${name},
            fields = ${fields !== undefined ? sql.json(fields) : sql`fields`}
          WHERE id = ${id}
          RETURNING *
        `;
        if (!row)
          throw createError({ status: 404, statusMessage: 'Not Found', data: { message: `Entity schema '${id}' not found` } });
        return row;
      } catch (e) {
        handleError(e, 'Failed to update entity schema');
      }
    })
  );

  // DELETE /api/entity-schemas/:id
  router.delete(
    `${BASE}/:id`,
    defineEventHandler(async event => {
      const id = event.context.params?.['id'];
      if (!id) throw createError({ status: 400, statusMessage: 'Bad Request', data: { message: 'id is required' } });
      try {
        const [row] = await sql<EntitySchemaRow[]>`DELETE FROM entity_schema WHERE id = ${id} RETURNING id`;
        if (!row)
          throw createError({ status: 404, statusMessage: 'Not Found', data: { message: `Entity schema '${id}' not found` } });
        return { success: true, message: `Entity schema '${id}' deleted` };
      } catch (e) {
        handleError(e, 'Failed to delete entity schema');
      }
    })
  );

  return router;
}
