import { createError, createRouter, defineEventHandler, getQuery, readBody } from 'h3';
import sql from '../db/client.js';

const BASE = '/api/data';

type EntityRow = {
  id: string;
  name: string;
  schema_id: string;
  data: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

// Flatten DB row into the wire format: { _uid, _schemaId, ...fields }
const toApiFormat = (row: EntityRow) => ({
  _uid: row.id,
  _schemaId: row.schema_id,
  ...row.data
});

type PostgresError = { code: string };

const handleError = (error: unknown, fallback: string): never => {
  if (error != null && typeof error === 'object' && 'statusCode' in error) throw error;
  if (error != null && typeof error === 'object' && 'code' in error) {
    const { code } = error as PostgresError;
    if (code === '23503') {
      throw createError({
        status: 400,
        statusMessage: 'Bad Request',
        data: { message: '_schemaId references a schema that does not exist' }
      });
    }
  }
  throw createError({ status: 500, statusMessage: 'Internal Server Error', data: { message: fallback } });
};

export function createDataRoutes() {
  const router = createRouter();

  // GET /api/data[?_schemaId=...]
  router.get(
    BASE,
    defineEventHandler(async event => {
      const { _schemaId } = getQuery(event);
      try {
        if (_schemaId && typeof _schemaId === 'string') {
          const rows = await sql<EntityRow[]>`SELECT * FROM entity WHERE schema_id = ${_schemaId} ORDER BY name`;
          return rows.map(toApiFormat);
        }
        const rows = await sql<EntityRow[]>`SELECT * FROM entity ORDER BY name`;
        return rows.map(toApiFormat);
      } catch (e) {
        handleError(e, 'Failed to retrieve data');
      }
    })
  );

  // GET /api/data/:id
  router.get(
    `${BASE}/:id`,
    defineEventHandler(async event => {
      const id = event.context.params?.['id'];
      if (!id) throw createError({ status: 400, statusMessage: 'Bad Request', data: { message: 'id is required' } });
      try {
        const [row] = await sql<EntityRow[]>`SELECT * FROM entity WHERE id = ${id}`;
        if (!row) throw createError({ status: 404, statusMessage: 'Not Found', data: { message: `Data record '${id}' not found` } });
        return toApiFormat(row);
      } catch (e) {
        handleError(e, 'Failed to retrieve data record');
      }
    })
  );

  // POST /api/data
  // Body: { _schemaId, ...fields }
  router.post(
    BASE,
    defineEventHandler(async event => {
      const body = await readBody(event);
      if (body == null || typeof body !== 'object')
        throw createError({ status: 400, statusMessage: 'Bad Request', data: { message: 'Request body must be a JSON object' } });
      const { _schemaId, ...fields } = body as Record<string, unknown>;
      if (!_schemaId || typeof _schemaId !== 'string')
        throw createError({ status: 400, statusMessage: 'Bad Request', data: { message: '_schemaId is required and must be a string (UUID)' } });
      // Derive name from fields for the DB name column, fall back to empty string
      const name = typeof fields['name'] === 'string' ? fields['name'] : '';
      try {
        const [row] = await sql<EntityRow[]>`
          INSERT INTO entity (name, schema_id, data)
          VALUES (${name}, ${_schemaId}, ${sql.json(fields)})
          RETURNING *
        `;
        return toApiFormat(row!);
      } catch (e) {
        handleError(e, 'Failed to create data record');
      }
    })
  );

  // PUT /api/data/:id
  // Body: { _schemaId, ...fields }
  router.put(
    `${BASE}/:id`,
    defineEventHandler(async event => {
      const id = event.context.params?.['id'];
      if (!id) throw createError({ status: 400, statusMessage: 'Bad Request', data: { message: 'id is required' } });
      const body = await readBody(event);
      if (body == null || typeof body !== 'object')
        throw createError({ status: 400, statusMessage: 'Bad Request', data: { message: 'Request body must be a JSON object' } });
      const { _schemaId, ...fields } = body as Record<string, unknown>;
      if (!_schemaId || typeof _schemaId !== 'string')
        throw createError({ status: 400, statusMessage: 'Bad Request', data: { message: '_schemaId is required and must be a string (UUID)' } });
      const name = typeof fields['name'] === 'string' ? fields['name'] : '';
      try {
        const [row] = await sql<EntityRow[]>`
          UPDATE entity SET
            name      = ${name},
            schema_id = ${_schemaId},
            data      = ${sql.json(fields)}
          WHERE id = ${id}
          RETURNING *
        `;
        if (!row) throw createError({ status: 404, statusMessage: 'Not Found', data: { message: `Data record '${id}' not found` } });
        return toApiFormat(row);
      } catch (e) {
        handleError(e, 'Failed to update data record');
      }
    })
  );

  // DELETE /api/data/:id
  router.delete(
    `${BASE}/:id`,
    defineEventHandler(async event => {
      const id = event.context.params?.['id'];
      if (!id) throw createError({ status: 400, statusMessage: 'Bad Request', data: { message: 'id is required' } });
      try {
        const [row] = await sql<EntityRow[]>`DELETE FROM entity WHERE id = ${id} RETURNING id`;
        if (!row) throw createError({ status: 404, statusMessage: 'Not Found', data: { message: `Data record '${id}' not found` } });
        return { success: true, message: `Data record '${id}' deleted` };
      } catch (e) {
        handleError(e, 'Failed to delete data record');
      }
    })
  );

  return router;
}
