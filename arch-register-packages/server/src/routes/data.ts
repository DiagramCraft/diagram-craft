import { H3, HTTPError, defineHandler, getQuery } from 'h3';
import sql from '../db/client.js';
import { decodeRefs, type Entity, type EntityApiResponse, type EntityLink, type EntitySchema, type SchemaField } from '../types.js';
import { logAudit, extractEntityFields } from '../db/audit.js';
import { resolveWorkspace } from './workspace-resolver.js';
import { generateCsv, formatArrayForCsv } from '../utils/csv.js';

const BASE = '/api/:workspace/data';

const getLifecycleValues = async (workspace: string): Promise<Set<string>> => {
  const rows = await sql<{ id: string }[]>`
    SELECT id FROM workspace_lifecycle_state WHERE workspace = ${workspace}
  `;
  return new Set(rows.map(r => r.id));
};

const getOwnerValues = async (workspace: string): Promise<Set<string>> => {
  const rows = await sql<{ id: string }[]>`
    SELECT id FROM workspace_owner WHERE workspace = ${workspace}
  `;
  return new Set(rows.map(r => r.id));
};

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


const parsePositiveInt = (value: unknown, field: string) => {
  if (value == null || value === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new HTTPError({
      status: 400,
      statusText: 'Bad Request',
      message: `${field} must be a non-negative integer`
    });
  }
  return parsed;
};

const toApiFormat = (row: Entity): EntityApiResponse => ({
  _uid: row.id,
  _workspace: row.workspace,
  _schemaId: row.schema_id,
  _name: row.name,
  _slug: row.slug,
  _namespace: row.namespace,
  _description: row.description,
  _owner: row.owner,
  _lifecycle: row.lifecycle,
  _tags: row.tags,
  _links: row.links,
  ...row.data
});

type EntitySummaryResponse = {
  _uid: string;
  _workspace: string;
  _schemaId: string;
  _name: string;
  _slug: string;
  _namespace: string;
  _description: string;
  _owner: string | null;
  _lifecycle: string | null;
  _tags: string[];
  _links: EntityLink[];
};

const toSummaryFormat = (row: Entity): EntitySummaryResponse => ({
  _uid: row.id,
  _workspace: row.workspace,
  _schemaId: row.schema_id,
  _name: row.name,
  _slug: row.slug,
  _namespace: row.namespace,
  _description: row.description,
  _owner: row.owner,
  _lifecycle: row.lifecycle,
  _tags: row.tags,
  _links: row.links
});

type RelationRecord = {
  entityId: string;
  entitySlug: string;
  entityName: string;
  entitySchemaId: string;
  fieldName: string;
  kind: 'reference' | 'containment';
};

type RelationsResponse = {
  outgoing: RelationRecord[];
  incoming: RelationRecord[];
};

const relationFields = (fields: SchemaField[]) =>
  fields.filter((field): field is Extract<SchemaField, { type: 'reference' | 'containment' }> =>
    field.type === 'reference' || field.type === 'containment'
  );

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
      const workspace = await resolveWorkspace(event);
      const query = getQuery(event);
      const schemaId = typeof query['_schemaId'] === 'string' ? query['_schemaId'] : null;
      const owner = typeof query['owner'] === 'string' ? query['owner'] : null;
      const lifecycle = typeof query['lifecycle'] === 'string' ? query['lifecycle'] : null;
      const q = typeof query['q'] === 'string' ? query['q'].trim() : '';
      const view = query['view'] === 'summary' ? 'summary' : 'full';
      const limit = parsePositiveInt(query['limit'], 'limit');
      const offset = parsePositiveInt(query['offset'], 'offset');
      const pattern = q ? `%${q}%` : null;
      try {
        const rows = await sql<Entity[]>`
          SELECT *
          FROM entity
          WHERE workspace = ${workspace}
            ${schemaId ? sql`AND schema_id = ${schemaId}` : sql``}
            ${owner ? sql`AND owner = ${owner}` : sql``}
            ${lifecycle ? sql`AND lifecycle = ${lifecycle}` : sql``}
            ${pattern ? sql`
              AND (
                name ILIKE ${pattern}
                OR slug ILIKE ${pattern}
                OR description ILIKE ${pattern}
                OR COALESCE(owner, '') ILIKE ${pattern}
                OR EXISTS (
                  SELECT 1
                  FROM unnest(tags) AS tag
                  WHERE tag ILIKE ${pattern}
                )
              )
            ` : sql``}
          ORDER BY name
          ${limit != null ? sql`LIMIT ${limit}` : sql``}
          ${offset != null ? sql`OFFSET ${offset}` : sql``}
        `;
        return view === 'summary' ? rows.map(toSummaryFormat) : rows.map(toApiFormat);
      } catch (e) {
        handleError(e, 'Failed to retrieve data');
      }
    })
  );

  // GET /api/:workspace/data/facets
  router.get(
    `${BASE}/facets`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event);
      try {
        const [totalRow] = await sql<{ count: number }[]>`
          SELECT COUNT(*)::int AS count
          FROM entity
          WHERE workspace = ${workspace}
        `;
        const lifecycle = await sql<{ value: string | null; count: number }[]>`
          SELECT lifecycle AS value, COUNT(*)::int AS count
          FROM entity
          WHERE workspace = ${workspace}
          GROUP BY lifecycle
          ORDER BY count DESC, value
        `;
        const owner = await sql<{ value: string | null; count: number }[]>`
          SELECT owner AS value, COUNT(*)::int AS count
          FROM entity
          WHERE workspace = ${workspace}
          GROUP BY owner
          ORDER BY count DESC, value
        `;
        const schema = await sql<{ schemaId: string; count: number }[]>`
          SELECT schema_id AS "schemaId", COUNT(*)::int AS count
          FROM entity
          WHERE workspace = ${workspace}
          GROUP BY schema_id
          ORDER BY count DESC, "schemaId"
        `;

        return {
          total: totalRow?.count ?? 0,
          lifecycle,
          owner,
          schema
        };
      } catch (e) {
        handleError(e, 'Failed to retrieve data facets');
      }
    })
  );

  // GET /api/:workspace/data/export - Export entities to CSV
  router.get(
    `${BASE}/export`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event);
      const query = getQuery(event);
      const schemaId = typeof query['_schemaId'] === 'string' ? query['_schemaId'] : null;
      const owner = typeof query['owner'] === 'string' ? query['owner'] : null;
      const lifecycle = typeof query['lifecycle'] === 'string' ? query['lifecycle'] : null;
      const q = typeof query['q'] === 'string' ? query['q'].trim() : '';
      const pattern = q ? `%${q}%` : null;

      try {
        // Fetch all schemas to resolve schema names
        const schemas = await sql<EntitySchema[]>`
          SELECT * FROM entity_schema WHERE workspace = ${workspace}
        `;
        const schemaMap = new Map(schemas.map(s => [s.id, s]));

        // Fetch entities with same filters as list endpoint
        const entities = await sql<Entity[]>`
          SELECT *
          FROM entity
          WHERE workspace = ${workspace}
            ${schemaId ? sql`AND schema_id = ${schemaId}` : sql``}
            ${owner ? sql`AND owner = ${owner}` : sql``}
            ${lifecycle ? sql`AND lifecycle = ${lifecycle}` : sql``}
            ${pattern ? sql`
              AND (
                name ILIKE ${pattern}
                OR slug ILIKE ${pattern}
                OR description ILIKE ${pattern}
                OR COALESCE(owner, '') ILIKE ${pattern}
                OR EXISTS (
                  SELECT 1
                  FROM unnest(tags) AS tag
                  WHERE tag ILIKE ${pattern}
                )
              )
            ` : sql``}
          ORDER BY name
        `;

        let csvContent: string;

        if (schemaId) {
          // Mode 2: Type-filtered export with schema fields
          const schema = schemaMap.get(schemaId);
          if (!schema) {
            throw new HTTPError({ status: 404, statusText: 'Not Found', message: 'Schema not found' });
          }

          // Collect all reference/containment field IDs that need resolution
          const refFields = relationFields(schema.fields);
          const allRefIds = new Set<string>();
          
          for (const entity of entities) {
            for (const field of refFields) {
              const refs = decodeRefs(entity.data[field.id]);
              refs.forEach(id => allRefIds.add(id));
            }
          }

          // Batch resolve all referenced entities
          const refEntities = allRefIds.size > 0
            ? await sql<Pick<Entity, 'id' | 'name' | 'slug'>[]>`
                SELECT id, name, slug
                FROM entity
                WHERE workspace = ${workspace} AND id IN ${sql([...allRefIds])}
              `
            : [];
          const refLookup = new Map(refEntities.map(e => [e.id, e.name || e.slug]));

          // Build columns: metadata + schema type + schema fields
          const columns = [
            'Name',
            'Slug',
            'Namespace',
            'Description',
            'Owner',
            'Lifecycle',
            'Tags',
            'Links',
            'Schema Type',
            ...schema.fields.map(f => f.name)
          ];

          // Build rows with resolved references
          const rows = entities.map(entity => {
            const row: Record<string, unknown> = {
              'Name': entity.name,
              'Slug': entity.slug,
              'Namespace': entity.namespace,
              'Description': entity.description,
              'Owner': entity.owner ?? '',
              'Lifecycle': entity.lifecycle ?? '',
              'Tags': formatArrayForCsv(entity.tags),
              'Links': entity.links.length.toString(),
              'Schema Type': schema.name
            };

            // Add schema-specific fields
            for (const field of schema.fields) {
              const value = entity.data[field.id];
              
              if (field.type === 'reference' || field.type === 'containment') {
                // Resolve references to entity names
                const refs = decodeRefs(value);
                const names = refs.map(id => refLookup.get(id) ?? id);
                row[field.name] = formatArrayForCsv(names);
              } else if (field.type === 'boolean') {
                row[field.name] = value === true ? 'true' : value === false ? 'false' : '';
              } else if (Array.isArray(value)) {
                row[field.name] = formatArrayForCsv(value);
              } else {
                row[field.name] = value ?? '';
              }
            }

            return row;
          });

          csvContent = generateCsv(rows, columns);
        } else {
          // Mode 1: All types export with metadata only
          const columns = [
            'Name',
            'Slug',
            'Namespace',
            'Description',
            'Owner',
            'Lifecycle',
            'Tags',
            'Links',
            'Schema Type'
          ];

          const rows = entities.map(entity => ({
            'Name': entity.name,
            'Slug': entity.slug,
            'Namespace': entity.namespace,
            'Description': entity.description,
            'Owner': entity.owner ?? '',
            'Lifecycle': entity.lifecycle ?? '',
            'Tags': formatArrayForCsv(entity.tags),
            'Links': entity.links.length.toString(),
            'Schema Type': schemaMap.get(entity.schema_id)?.name ?? entity.schema_id
          }));

          csvContent = generateCsv(rows, columns);
        }

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().split('T')[0];
        const schemaName = schemaId ? schemaMap.get(schemaId)?.name.toLowerCase().replace(/\s+/g, '-') : 'entities';
        const filename = `${schemaName}-${timestamp}.csv`;

        // Set response headers for CSV download
        if (event.node?.res) {
          event.node.res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          event.node.res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        }
        
        return csvContent;
      } catch (e) {
        handleError(e, 'Failed to export data');
      }
    })
  );

  // GET /api/:workspace/data/:id
  router.get(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event);
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

  // GET /api/:workspace/data/:id/relations
  router.get(
    `${BASE}/:id/relations`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event);
      const id = event.context.params?.['id'];
      if (!id) throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'id is required' });

      try {
        const [entity] = await sql<Entity[]>`
          SELECT *
          FROM entity
          WHERE workspace = ${workspace} AND id = ${id}
        `;
        if (!entity) {
          throw new HTTPError({ status: 404, statusText: 'Not Found', message: `Data record '${id}' not found` });
        }

        const schemas = await sql<EntitySchema[]>`
          SELECT *
          FROM entity_schema
          WHERE workspace = ${workspace}
        `;
        const schemaMap = new Map(schemas.map(schema => [schema.id, schema]));
        const entitySchema = schemaMap.get(entity.schema_id);
        const outgoingFields = relationFields(entitySchema?.fields ?? []);

        const outgoingIds = new Set<string>();
        for (const field of outgoingFields) {
          for (const refId of decodeRefs(entity.data[field.id])) {
            outgoingIds.add(refId);
          }
        }

        const outgoingTargets = outgoingIds.size > 0
          ? await sql<Pick<Entity, 'id' | 'slug' | 'name' | 'schema_id'>[]>`
              SELECT id, slug, name, schema_id
              FROM entity
              WHERE workspace = ${workspace} AND id IN ${sql([...outgoingIds])}
            `
          : [];
        const outgoingLookup = new Map(outgoingTargets.map(target => [target.id, target]));

        const outgoing: RelationRecord[] = [];
        for (const field of outgoingFields) {
          for (const refId of decodeRefs(entity.data[field.id])) {
            const target = outgoingLookup.get(refId);
            outgoing.push({
              entityId: refId,
              entitySlug: target?.slug ?? refId,
              entityName: target?.name ?? target?.slug ?? refId,
              entitySchemaId: target?.schema_id ?? field.schemaId,
              fieldName: field.name,
              kind: field.type
            });
          }
        }

        const referencingSchemaIds = schemas
          .filter(schema => relationFields(schema.fields).length > 0)
          .map(schema => schema.id);
        const incomingRows = referencingSchemaIds.length > 0
          ? await sql<Pick<Entity, 'id' | 'slug' | 'name' | 'schema_id' | 'data'>[]>`
              SELECT id, slug, name, schema_id, data
              FROM entity
              WHERE workspace = ${workspace}
                AND schema_id IN ${sql(referencingSchemaIds)}
                AND id <> ${id}
            `
          : [];

        const incoming: RelationRecord[] = [];
        for (const row of incomingRows) {
          const rowSchema = schemaMap.get(row.schema_id);
          if (!rowSchema) continue;
          for (const field of relationFields(rowSchema.fields)) {
            if (!decodeRefs(row.data[field.id]).includes(id)) continue;
            incoming.push({
              entityId: row.id,
              entitySlug: row.slug,
              entityName: row.name || row.slug,
              entitySchemaId: row.schema_id,
              fieldName: field.name,
              kind: field.type
            });
          }
        }

        const response: RelationsResponse = { outgoing, incoming };
        return response;
      } catch (e) {
        handleError(e, 'Failed to retrieve data relations');
      }
    })
  );

  // POST /api/:workspace/data
  // Body: { _schemaId, _slug?, _namespace?, _owner?, _lifecycle?, ...fields }
  router.post(
    BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event);
      const body = await event.req.json().catch(() => undefined);
      if (body == null || typeof body !== 'object')
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'Request body must be a JSON object' });

      const { _schemaId, _name, _slug, _namespace = 'default', _description = '', _owner = null, _lifecycle = null, _tags = [], _links = [], ...fields } =
        body as Record<string, unknown>;

      if (!_schemaId || typeof _schemaId !== 'string')
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: '_schemaId is required and must be a string (UUID)' });

      // Support _name as the canonical name field; fall back to legacy `name` in data fields
      const name = typeof _name === 'string' ? _name : (typeof fields['name'] === 'string' ? fields['name'] : '');
      delete fields['name'];

      const slug = typeof _slug === 'string' && _slug ? _slug : slugify(name);
      if (!slug)
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: '_slug (or a _name to derive it from) is required' });

      const namespace = typeof _namespace === 'string' ? _namespace : 'default';
      const description = typeof _description === 'string' ? _description : '';

      const lifecycleValues = await getLifecycleValues(workspace);
      const lifecycle =
        typeof _lifecycle === 'string' && lifecycleValues.has(_lifecycle) ? _lifecycle : null;

      const ownerValues = await getOwnerValues(workspace);
      const owner =
        typeof _owner === 'string' && ownerValues.has(_owner) ? _owner : null;

      const tags = Array.isArray(_tags) ? _tags.filter((t): t is string => typeof t === 'string') : [];
      const links = Array.isArray(_links) ? (_links as EntityLink[]) : [];

      try {
        const [row] = await sql<Entity[]>`
          INSERT INTO entity (workspace, slug, namespace, name, description, owner, lifecycle, tags, links, schema_id, data)
          VALUES (${workspace}, ${slug}, ${namespace}, ${name}, ${description}, ${owner}, ${lifecycle}, ${tags}, ${json(links)}, ${_schemaId}, ${json(fields)})
          RETURNING *
        `;
        
        // Log audit entry
        await logAudit({
          workspace,
          operation: 'create',
          entityType: 'entity',
          entityId: row!.id,
          entityName: row!.name,
          entitySlug: row!.slug,
          schemaId: row!.schema_id,
          changes: {
            new: extractEntityFields(row!),
          },
        });
        
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
      const workspace = await resolveWorkspace(event);
      const id = event.context.params?.['id'];
      if (!id) throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'id is required' });

      const body = await event.req.json().catch(() => undefined);
      if (body == null || typeof body !== 'object')
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'Request body must be a JSON object' });

      const { _schemaId, _name, _slug, _namespace, _description = '', _owner, _lifecycle, _tags = [], _links = [], ...fields } = body as Record<string, unknown>;

      if (!_schemaId || typeof _schemaId !== 'string')
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: '_schemaId is required and must be a string (UUID)' });

      const name = typeof _name === 'string' ? _name : (typeof fields['name'] === 'string' ? fields['name'] : '');
      delete fields['name'];

      const slug = typeof _slug === 'string' && _slug ? _slug : slugify(name);
      if (!slug)
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: '_slug (or a _name to derive it from) is required' });

      const namespace = typeof _namespace === 'string' ? _namespace : 'default';
      const description = typeof _description === 'string' ? _description : '';

      const lifecycleValues = await getLifecycleValues(workspace);
      const lifecycle =
        typeof _lifecycle === 'string' && lifecycleValues.has(_lifecycle) ? _lifecycle : null;

      const ownerValues = await getOwnerValues(workspace);
      const owner =
        typeof _owner === 'string' && ownerValues.has(_owner) ? _owner : null;

      const tags = Array.isArray(_tags) ? _tags.filter((t): t is string => typeof t === 'string') : [];
      const links = Array.isArray(_links) ? (_links as EntityLink[]) : [];

      try {
        // Fetch old state for audit log
        const [oldRow] = await sql<Entity[]>`
          SELECT * FROM entity WHERE workspace = ${workspace} AND id = ${id}
        `;
        if (!oldRow) throw new HTTPError({ status: 404, statusText: 'Not Found', message: `Data record '${id}' not found` });
        
        const [row] = await sql<Entity[]>`
          UPDATE entity SET
            name        = ${name},
            description = ${description},
            schema_id   = ${_schemaId},
            slug        = ${slug},
            namespace   = ${namespace},
            owner       = ${owner},
            lifecycle   = ${lifecycle},
            tags        = ${tags},
            links       = ${json(links)},
            data        = ${json(fields)}
          WHERE workspace = ${workspace} AND id = ${id}
          RETURNING *
        `;
        
        // Log audit entry with field-level changes
        const { computeChanges } = await import('../db/audit.js');
        const changes = computeChanges(
          extractEntityFields(oldRow),
          extractEntityFields(row!)
        );
        
        await logAudit({
          workspace,
          operation: 'update',
          entityType: 'entity',
          entityId: id,
          entityName: row!.name,
          entitySlug: row!.slug,
          schemaId: row!.schema_id,
          changes,
        });
        
        return toApiFormat(row!);
      } catch (e) {
        handleError(e, 'Failed to update data record');
      }
    })
  );

  // DELETE /api/:workspace/data/:id
  router.delete(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event);
      const id = event.context.params?.['id'];
      if (!id) throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'id is required' });
      try {
        // Fetch entity before deletion for audit log
        const [row] = await sql<Entity[]>`
          SELECT * FROM entity WHERE workspace = ${workspace} AND id = ${id}
        `;
        if (!row) throw new HTTPError({ status: 404, statusText: 'Not Found', message: `Data record '${id}' not found` });
        
        // Delete entity
        await sql`DELETE FROM entity WHERE workspace = ${workspace} AND id = ${id}`;
        
        // Log audit entry
        await logAudit({
          workspace,
          operation: 'delete',
          entityType: 'entity',
          entityId: id,
          entityName: row.name,
          entitySlug: row.slug,
          schemaId: row.schema_id,
          changes: {
            old: extractEntityFields(row),
          },
        });
        
        return { success: true, message: `Data record '${id}' deleted` };
      } catch (e) {
        handleError(e, 'Failed to delete data record');
      }
    })
  );

  return router;
}
