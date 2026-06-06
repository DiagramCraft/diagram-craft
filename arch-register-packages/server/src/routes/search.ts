import { H3, defineHandler, getQuery } from 'h3';
import type { DatabaseAdapter } from '../db/database.js';
import type { Entity, SchemaField } from '../types.js';
import { resolveWorkspace } from '../utils/resolveWorkspace.js';
import { parsePositiveInt } from '../utils/http.js';
import { SEARCH_DEFAULTS } from '../constants.js';
import { buildApiAuthCtx, canAccessProject } from '../auth/authorization.js';
import type { AuthenticatedEvent } from '../middleware/auth.js';
import { PermissionChecker } from '@arch-register/permissions';
import { httpAssert } from '../utils/httpAssert.js';

const BASE = '/api/:workspace/search';

export const SEARCH_TYPES = ['projects', 'files', 'entities', 'schemas'] as const;

export type SearchType = (typeof SEARCH_TYPES)[number];

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

export const parseTypes = (value: unknown): SearchType[] => {
  if (value == null || value === '') return [...SEARCH_TYPES];
  const parsed = String(value)
    .split(',')
    .map(type => type.trim())
    .filter((type): type is SearchType => type.length > 0);

  const invalid = parsed.filter(type => !SEARCH_TYPES.includes(type as SearchType));
  httpAssert.true(invalid.length === 0, {
    message: `types must be a comma-separated list of: ${SEARCH_TYPES.join(', ')}`
  });

  return [...new Set(parsed as SearchType[])];
};

export const includesQuery = (value: unknown, query: string) =>
  String(value ?? '')
    .toLowerCase()
    .includes(query);

export const collectMatchedMetadata = (entity: Entity, query: string) => {
  const matches: string[] = [];
  if (includesQuery(entity.name, query)) matches.push('name');
  if (includesQuery(entity.slug, query)) matches.push('slug');
  if (includesQuery(entity.description, query)) matches.push('description');
  if (includesQuery(entity.namespace, query)) matches.push('namespace');
  if (includesQuery(entity.owner, query)) matches.push('owner');
  if (includesQuery(entity.lifecycle, query)) matches.push('lifecycle');
  if (entity.tags.some(tag => includesQuery(tag, query))) matches.push('tags');
  if (
    entity.links.some(
      link =>
        includesQuery(link.title, query) ||
        includesQuery(link.url, query) ||
        includesQuery(link.type, query)
    )
  ) {
    matches.push('links');
  }
  return matches;
};

export const collectMatchedFields = (data: Entity['data'], query: string) =>
  Object.entries(data)
    .filter(([, value]) => includesQuery(value, query))
    .map(([key]) => key);

export const collectFieldMatches = (fields: SchemaField[], query: string): SchemaFieldMatch[] =>
  fields
    .filter(field => includesQuery(field.id, query) || includesQuery(field.name, query))
    .map(field => ({
      fieldId: field.id,
      fieldName: field.name
    }));

export function createSearchRoutes(db: DatabaseAdapter) {
  const router = new H3();
  const checker = new PermissionChecker();

  router.get(
    BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      const query = getQuery(event);
      const q = typeof query['q'] === 'string' ? query['q'].trim() : '';
      const limitPerType =
        parsePositiveInt(query['limitPerType'], 'limitPerType') ?? SEARCH_DEFAULTS.LIMIT_PER_TYPE;
      const types = parseTypes(query['types']);

      const empty: SearchResponse = {
        query: q,
        projects: [],
        files: [],
        entities: [],
        schemas: []
      };

      if (q === '') return empty;

      const normalizedQuery = q.toLowerCase();

      const [projects, schemas, entities] = await Promise.all([
        types.includes('projects') || types.includes('files')
          ? db.projectsFiles.listProjects(workspace)
          : Promise.resolve([]),
        types.includes('schemas') || types.includes('entities')
          ? db.catalog.listSchemas(workspace)
          : Promise.resolve([]),
        types.includes('entities') ? db.catalog.listEntities(workspace) : Promise.resolve([])
      ]);

      const visibleEntities = authCtx
        ? entities.filter(entity => checker.hasEntityPermission(authCtx, entity, 'view_entity'))
        : entities;
      const visibleProjects = projects.filter(project => canAccessProject(authCtx, project.owner));

      const projectsResults = types.includes('projects')
        ? visibleProjects
            .filter(
              project =>
                includesQuery(project.name, normalizedQuery) ||
                includesQuery(project.description, normalizedQuery)
            )
            .sort((a, b) => a.name.localeCompare(b.name))
            .slice(0, limitPerType)
        : [];

      const filesResults: FileSearchResult[] = [];
      if (types.includes('files')) {
        const projectsForFiles = visibleProjects;
        const projectMap = new Map(projectsForFiles.map(project => [project.id, project.name]));
        const projectIds = [...projectMap.keys()];

        const filesByProject = await Promise.all(
          projectIds.map(async projectId => ({
            projectId,
            files: await db.projectsFiles.listProjectFiles(workspace, projectId)
          }))
        );

        for (const { projectId, files } of filesByProject) {
          const projectName = projectMap.get(projectId) ?? projectId;
          for (const file of files) {
            if (
              !includesQuery(file.name, normalizedQuery) &&
              !includesQuery(file.path, normalizedQuery)
            )
              continue;
            filesResults.push({
              projectId: file.project_id,
              projectName,
              fileId: file.id,
              path: file.path,
              name: file.name
            });
          }
        }
        filesResults.sort(
          (a, b) => a.projectName.localeCompare(b.projectName) || a.path.localeCompare(b.path)
        );
      }

      const schemaMap = new Map(schemas.map(schema => [schema.id, schema]));
      const entityResults = types.includes('entities')
        ? visibleEntities
            .map(entity => {
              const matchedFields = collectMatchedFields(entity.data, normalizedQuery);
              const matchedMetadata = collectMatchedMetadata(entity, normalizedQuery);
              if (matchedFields.length === 0 && matchedMetadata.length === 0) return null;
              return {
                entityId: entity.id,
                schemaId: entity.schema_id,
                schemaName: schemaMap.get(entity.schema_id)?.name ?? entity.schema_id,
                _name: entity.name,
                _slug: entity.slug,
                _description: entity.description,
                _owner: entity.owner,
                _lifecycle: entity.lifecycle,
                matchedFields,
                matchedMetadata
              } satisfies EntitySearchResult;
            })
            .filter((entity): entity is EntitySearchResult => entity !== null)
            .sort((a, b) => a._name.localeCompare(b._name))
            .slice(0, limitPerType)
        : [];

      const schemaResults = types.includes('schemas')
        ? schemas
            .map(schema => {
              const fieldMatches = collectFieldMatches(schema.fields, normalizedQuery);
              if (!includesQuery(schema.name, normalizedQuery) && fieldMatches.length === 0)
                return null;
              return {
                schemaId: schema.id,
                name: schema.name,
                fieldMatches
              } satisfies SchemaSearchResult;
            })
            .filter((schema): schema is SchemaSearchResult => schema !== null)
            .sort((a, b) => a.name.localeCompare(b.name))
            .slice(0, limitPerType)
        : [];

      return {
        query: q,
        projects: projectsResults,
        files: filesResults.slice(0, limitPerType),
        entities: entityResults,
        schemas: schemaResults
      } satisfies SearchResponse;
    })
  );

  return router;
}
