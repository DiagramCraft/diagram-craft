import { H3, HTTPError, defineHandler, getQuery } from 'h3';
import sql from '../db/client.js';
import type { Entity, EntitySchema, SchemaField } from '../types.js';
import { resolveWorkspace } from './workspace-resolver.js';

const BASE = '/api/:workspace/search';

const SEARCH_TYPES = ['projects', 'files', 'entities', 'schemas'] as const;

type SearchType = (typeof SEARCH_TYPES)[number];

type ProjectSearchResult = {
  id: string;
  name: string;
  description: string;
  status: 'pinned' | 'active' | 'archived';
};

type FileSearchResult = {
  projectId: string;
  projectName: string;
  fileId: string;
  path: string;
  name: string;
};

type EntitySearchResult = {
  entityId: string;
  schemaId: string;
  schemaName: string;
  _name: string;
  _slug: string;
  _description: string;
  _owner: string | null;
  _lifecycle: Entity['lifecycle'];
  matchedFields: string[];
  matchedMetadata: string[];
};

type SchemaFieldMatch = {
  fieldId: string;
  fieldName: string;
};

type SchemaSearchResult = {
  schemaId: string;
  name: string;
  fieldMatches: SchemaFieldMatch[];
};

type SearchResponse = {
  query: string;
  projects: ProjectSearchResult[];
  files: FileSearchResult[];
  entities: EntitySearchResult[];
  schemas: SchemaSearchResult[];
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

const parseTypes = (value: unknown): SearchType[] => {
  if (value == null || value === '') return [...SEARCH_TYPES];
  const parsed = String(value)
    .split(',')
    .map(type => type.trim())
    .filter((type): type is SearchType => type.length > 0);

  const invalid = parsed.filter(type => !SEARCH_TYPES.includes(type as SearchType));
  if (invalid.length > 0) {
    throw new HTTPError({
      status: 400,
      statusText: 'Bad Request',
      message: `types must be a comma-separated list of: ${SEARCH_TYPES.join(', ')}`
    });
  }

  return [...new Set(parsed as SearchType[])];
};

const includesQuery = (value: unknown, query: string) => String(value ?? '').toLowerCase().includes(query);

const collectMatchedMetadata = (entity: Entity, query: string) => {
  const matches: string[] = [];
  if (includesQuery(entity.name, query)) matches.push('name');
  if (includesQuery(entity.slug, query)) matches.push('slug');
  if (includesQuery(entity.description, query)) matches.push('description');
  if (includesQuery(entity.namespace, query)) matches.push('namespace');
  if (includesQuery(entity.owner, query)) matches.push('owner');
  if (includesQuery(entity.lifecycle, query)) matches.push('lifecycle');
  if (entity.tags.some(tag => includesQuery(tag, query))) matches.push('tags');
  if (entity.links.some(link => includesQuery(link.title, query) || includesQuery(link.url, query) || includesQuery(link.type, query))) {
    matches.push('links');
  }
  return matches;
};

const collectMatchedFields = (data: Entity['data'], query: string) =>
  Object.entries(data)
    .filter(([, value]) => includesQuery(value, query))
    .map(([key]) => key);

const collectFieldMatches = (fields: SchemaField[], query: string): SchemaFieldMatch[] =>
  fields
    .filter(field => includesQuery(field.id, query) || includesQuery(field.name, query))
    .map(field => ({
      fieldId: field.id,
      fieldName: field.name
    }));

export function createSearchRoutes() {
  const router = new H3();

  router.get(
    BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event);
      const query = getQuery(event);
      const q = typeof query['q'] === 'string' ? query['q'].trim() : '';
      const limitPerType = parsePositiveInt(query['limitPerType'], 'limitPerType') ?? 10;
      const types = parseTypes(query['types']);

      const empty: SearchResponse = {
        query: q,
        projects: [],
        files: [],
        entities: [],
        schemas: []
      };

      if (q === '') return empty;

      const pattern = `%${q}%`;
      const normalizedQuery = q.toLowerCase();

      const projectsPromise = types.includes('projects')
        ? sql<ProjectSearchResult[]>`
            SELECT id, name, description, status
            FROM project
            WHERE workspace = ${workspace}
              AND (
                name ILIKE ${pattern}
                OR description ILIKE ${pattern}
              )
            ORDER BY name
            LIMIT ${limitPerType}
          `
        : Promise.resolve([]);

      const filesPromise = types.includes('files')
        ? sql<FileSearchResult[]>`
            SELECT
              pf.project_id AS "projectId",
              p.name AS "projectName",
              pf.id AS "fileId",
              pf.path,
              pf.name
            FROM project_file pf
            INNER JOIN project p
              ON p.workspace = pf.workspace
             AND p.id = pf.project_id
            WHERE pf.workspace = ${workspace}
              AND (
                pf.name ILIKE ${pattern}
                OR pf.path ILIKE ${pattern}
              )
            ORDER BY p.name, pf.path
            LIMIT ${limitPerType}
          `
        : Promise.resolve([]);

      const entitiesPromise = types.includes('entities')
        ? sql<(Entity & { schemaName: string })[]>`
            SELECT
              e.*,
              s.name AS "schemaName"
            FROM entity e
            INNER JOIN entity_schema s
              ON s.workspace = e.workspace
             AND s.id = e.schema_id
            WHERE e.workspace = ${workspace}
              AND (
                e.name ILIKE ${pattern}
                OR e.slug ILIKE ${pattern}
                OR e.description ILIKE ${pattern}
                OR e.namespace ILIKE ${pattern}
                OR COALESCE(e.owner, '') ILIKE ${pattern}
                OR COALESCE(e.lifecycle, '') ILIKE ${pattern}
                OR EXISTS (
                  SELECT 1
                  FROM unnest(e.tags) AS tag
                  WHERE tag ILIKE ${pattern}
                )
                OR EXISTS (
                  SELECT 1
                  FROM jsonb_array_elements(e.links) AS link
                  WHERE link->>'title' ILIKE ${pattern}
                     OR link->>'url' ILIKE ${pattern}
                     OR COALESCE(link->>'type', '') ILIKE ${pattern}
                )
                OR EXISTS (
                  SELECT 1
                  FROM jsonb_each_text(e.data) AS field(key, value)
                  WHERE value ILIKE ${pattern}
                )
              )
            ORDER BY e.name
            LIMIT ${limitPerType}
          `
        : Promise.resolve([]);

      const schemasPromise = types.includes('schemas')
        ? sql<EntitySchema[]>`
            SELECT *
            FROM entity_schema
            WHERE workspace = ${workspace}
              AND (
                name ILIKE ${pattern}
                OR EXISTS (
                  SELECT 1
                  FROM jsonb_array_elements(fields) AS field
                  WHERE field->>'id' ILIKE ${pattern}
                     OR field->>'name' ILIKE ${pattern}
                )
              )
            ORDER BY name
            LIMIT ${limitPerType}
          `
        : Promise.resolve([]);

      const [projects, files, entities, schemas] = await Promise.all([
        projectsPromise,
        filesPromise,
        entitiesPromise,
        schemasPromise
      ]);

      return {
        query: q,
        projects,
        files,
        entities: entities.map(entity => ({
          entityId: entity.id,
          schemaId: entity.schema_id,
          schemaName: entity.schemaName,
          _name: entity.name,
          _slug: entity.slug,
          _description: entity.description,
          _owner: entity.owner,
          _lifecycle: entity.lifecycle,
          matchedFields: collectMatchedFields(entity.data, normalizedQuery),
          matchedMetadata: collectMatchedMetadata(entity, normalizedQuery)
        })),
        schemas: schemas.map(schema => ({
          schemaId: schema.id,
          name: schema.name,
          fieldMatches: collectFieldMatches(schema.fields, normalizedQuery)
        }))
      } satisfies SearchResponse;
    })
  );

  return router;
}
