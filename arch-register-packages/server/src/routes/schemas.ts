import { createError, createRouter, defineEventHandler, readBody } from 'h3';
import sql from '../db/client.js';

const BASE = '/api/schemas';

type EntitySchemaRow = {
  id: string;
  name: string;
  fields: unknown;
  created_at: Date;
  updated_at: Date;
};

// Add source: 'external' at the API layer — it is implicit and not stored in the DB
const toApiFormat = (row: EntitySchemaRow) => ({ ...row, source: 'external' });

type PostgresError = { code: string };

const handleError = (error: unknown, fallback: string): never => {
  if (error != null && typeof error === 'object' && 'statusCode' in error) throw error;
  if (error != null && typeof error === 'object' && 'code' in error) {
    const { code } = error as PostgresError;
    if (code === '23505') {
      throw createError({
        status: 409,
        statusMessage: 'Conflict',
        data: { message: 'A schema with that name already exists' }
      });
    }
    if (code === '23503') {
      throw createError({
        status: 409,
        statusMessage: 'Conflict',
        data: { message: 'Cannot delete schema: data records still reference it' }
      });
    }
  }
  throw createError({ status: 500, statusMessage: 'Internal Server Error', data: { message: fallback } });
};

export function createSchemaRoutes() {
  const router = createRouter();

  // GET /api/schemas
  router.get(
    BASE,
    defineEventHandler(async () => {
      try {
        const rows = await sql<EntitySchemaRow[]>`SELECT * FROM entity_schema ORDER BY name`;
        return rows.map(toApiFormat);
      } catch (e) {
        handleError(e, 'Failed to retrieve schemas');
      }
    })
  );

  // GET /api/schemas/:id
  router.get(
    `${BASE}/:id`,
    defineEventHandler(async event => {
      const id = event.context.params?.['id'];
      if (!id) throw createError({ status: 400, statusMessage: 'Bad Request', data: { message: 'id is required' } });
      try {
        const [row] = await sql<EntitySchemaRow[]>`SELECT * FROM entity_schema WHERE id = ${id}`;
        if (!row) throw createError({ status: 404, statusMessage: 'Not Found', data: { message: `Schema '${id}' not found` } });
        return toApiFormat(row);
      } catch (e) {
        handleError(e, 'Failed to retrieve schema');
      }
    })
  );

  // POST /api/schemas
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
        return toApiFormat(row!);
      } catch (e) {
        handleError(e, 'Failed to create schema');
      }
    })
  );

  // PUT /api/schemas/:id
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
        if (!row) throw createError({ status: 404, statusMessage: 'Not Found', data: { message: `Schema '${id}' not found` } });
        return toApiFormat(row);
      } catch (e) {
        handleError(e, 'Failed to update schema');
      }
    })
  );

  // DELETE /api/schemas/:id
  router.delete(
    `${BASE}/:id`,
    defineEventHandler(async event => {
      const id = event.context.params?.['id'];
      if (!id) throw createError({ status: 400, statusMessage: 'Bad Request', data: { message: 'id is required' } });
      try {
        const [row] = await sql<EntitySchemaRow[]>`DELETE FROM entity_schema WHERE id = ${id} RETURNING id`;
        if (!row) throw createError({ status: 404, statusMessage: 'Not Found', data: { message: `Schema '${id}' not found` } });
        return { success: true, message: `Schema '${id}' deleted` };
      } catch (e) {
        handleError(e, 'Failed to delete schema');
      }
    })
  );

  return router;
}
