import { H3, H3Event, HTTPError, defineHandler, getQuery } from 'h3';
import sql from '../db/client.js';
import type { Entity, EntityApiResponse, LifecycleStatus } from '../types.js';

const BASE = '/api/:workspace/data';

const LIFECYCLE_VALUES = new Set<string>(['experimental', 'production', 'deprecated']);

// body is already parsed JSON; cast is safe but needed because postgres's JSONValue type
// is more restrictive than the `unknown` we get from readBody.
const json = (v: unknown) => sql.json(v as Parameters<typeof sql.json>[0]);

type PostgresError = { code: string };

const handleError = (error: unknown, fallback: string): never => {
  if (HTTPError.isError(error)) throw error;
  if (error != null && typeof error === 'object' && 'code' in error) {
    const { code } = error as PostgresError;
    if (code === '23503') {
      throw new HTTPError({ status: 400, statusText: 'Bad Request', message: '_schemaId references a schema that does not exist' });
    }
    if (code === '23505') {
      throw new HTTPError({
        status: 409,
        statusText: 'Conflict',
        message: 'An entity with that slug already exists in this namespace for the given schema in this workspace'
      });
    }
  }
  throw new HTTPError({ status: 500, statusText: 'Internal Server Error', message: fallback });
};

const getWorkspace = (event: H3Event) => {
  const workspace = event.context.params?.['workspace'];
  if (!workspace) throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'workspace is required' });
  return workspace;
};

const toApiFormat = (row: Entity): EntityApiResponse => ({
  _uid: row.id,
  _workspace: row.workspace,
  _schemaId: row.schema_id,
  _slug: row.slug,
  _namespace: row.namespace,
  _owner: row.owner,
  _lifecycle: row.lifecycle,
  ...row.data
});

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function createDataRoutes() {
  const router = new H3();

  // GET /api/:workspace/data[?_schemaId=...]
  router.get(
    BASE,
    defineHandler(async event => {
      const workspace = getWorkspace(event);
      const { _schemaId } = getQuery(event);
      try {
        if (_schemaId && typeof _schemaId === 'string') {
          const rows = await sql<Entity[]>`
            SELECT * FROM entity WHERE workspace = ${workspace} AND schema_id = ${_schemaId} ORDER BY name
          `;
          return rows.map(toApiFormat);
        }
        const rows = await sql<Entity[]>`SELECT * FROM entity WHERE workspace = ${workspace} ORDER BY name`;
        return rows.map(toApiFormat);
      } catch (e) {
        handleError(e, 'Failed to retrieve data');
      }
    })
  );

  // GET /api/:workspace/data/:id
  router.get(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = getWorkspace(event);
      const id = event.context.params?.['id'];
      if (!id) throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'id is required' });
      try {
        const [row] = await sql<Entity[]>`SELECT * FROM entity WHERE workspace = ${workspace} AND id = ${id}`;
        if (!row) throw new HTTPError({ status: 404, statusText: 'Not Found', message: `Data record '${id}' not found` });
        return toApiFormat(row);
      } catch (e) {
        handleError(e, 'Failed to retrieve data record');
      }
    })
  );

  // POST /api/:workspace/data
  // Body: { _schemaId, _slug?, _namespace?, _owner?, _lifecycle?, ...fields }
  router.post(
    BASE,
    defineHandler(async event => {
      const workspace = getWorkspace(event);
      const body = await event.req.json().catch(() => undefined);
      if (body == null || typeof body !== 'object')
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'Request body must be a JSON object' });

      const { _schemaId, _slug, _namespace = 'default', _owner = null, _lifecycle = null, ...fields } =
        body as Record<string, unknown>;

      if (!_schemaId || typeof _schemaId !== 'string')
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: '_schemaId is required and must be a string (UUID)' });

      const name = typeof fields['name'] === 'string' ? fields['name'] : '';
      const slug = typeof _slug === 'string' && _slug ? _slug : slugify(name);
      if (!slug)
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: '_slug (or a name to derive it from) is required' });

      const namespace = typeof _namespace === 'string' ? _namespace : 'default';
      const owner = typeof _owner === 'string' ? _owner : null;
      const lifecycle =
        typeof _lifecycle === 'string' && LIFECYCLE_VALUES.has(_lifecycle)
          ? (_lifecycle as LifecycleStatus)
          : null;

      try {
        const [row] = await sql<Entity[]>`
          INSERT INTO entity (workspace, slug, namespace, name, owner, lifecycle, schema_id, data)
          VALUES (${workspace}, ${slug}, ${namespace}, ${name}, ${owner}, ${lifecycle}, ${_schemaId}, ${json(fields)})
          RETURNING *
        `;
        return toApiFormat(row!);
      } catch (e) {
        handleError(e, 'Failed to create data record');
      }
    })
  );

  // PUT /api/:workspace/data/:id  (full replacement)
  // Body: { _schemaId, _slug?, _namespace?, _owner?, _lifecycle?, ...fields }
  router.put(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = getWorkspace(event);
      const id = event.context.params?.['id'];
      if (!id) throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'id is required' });

      const body = await event.req.json().catch(() => undefined);
      if (body == null || typeof body !== 'object')
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'Request body must be a JSON object' });

      const { _schemaId, _slug, _namespace, _owner, _lifecycle, ...fields } = body as Record<string, unknown>;

      if (!_schemaId || typeof _schemaId !== 'string')
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: '_schemaId is required and must be a string (UUID)' });

      const name = typeof fields['name'] === 'string' ? fields['name'] : '';
      const slug = typeof _slug === 'string' && _slug ? _slug : slugify(name);
      if (!slug)
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: '_slug (or a name to derive it from) is required' });

      const namespace = typeof _namespace === 'string' ? _namespace : 'default';
      const owner = typeof _owner === 'string' ? _owner : null;
      const lifecycle =
        typeof _lifecycle === 'string' && LIFECYCLE_VALUES.has(_lifecycle)
          ? (_lifecycle as LifecycleStatus)
          : null;

      try {
        const [row] = await sql<Entity[]>`
          UPDATE entity SET
            name      = ${name},
            schema_id = ${_schemaId},
            slug      = ${slug},
            namespace = ${namespace},
            owner     = ${owner},
            lifecycle = ${lifecycle},
            data      = ${json(fields)}
          WHERE workspace = ${workspace} AND id = ${id}
          RETURNING *
        `;
        if (!row) throw new HTTPError({ status: 404, statusText: 'Not Found', message: `Data record '${id}' not found` });
        return toApiFormat(row);
      } catch (e) {
        handleError(e, 'Failed to update data record');
      }
    })
  );

  // DELETE /api/:workspace/data/:id
  router.delete(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = getWorkspace(event);
      const id = event.context.params?.['id'];
      if (!id) throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'id is required' });
      try {
        const [row] = await sql<Entity[]>`
          DELETE FROM entity WHERE workspace = ${workspace} AND id = ${id} RETURNING id
        `;
        if (!row) throw new HTTPError({ status: 404, statusText: 'Not Found', message: `Data record '${id}' not found` });
        return { success: true, message: `Data record '${id}' deleted` };
      } catch (e) {
        handleError(e, 'Failed to delete data record');
      }
    })
  );

  return router;
}
