import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { buildApiAuthCtx, canAccessProject } from '../auth/authorization';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { SEARCH_DEFAULTS } from '../../constants';
import { PermissionChecker } from '@arch-register/permissions';
import type { EntityDbResult } from '../catalog/db/catalogDatabase';
import { SchemaField } from '@arch-register/api-types/schemas';

const checker = new PermissionChecker();

export const SEARCH_TYPES = ['projects', 'files', 'entities', 'schemas'] as const;
type SearchType = (typeof SEARCH_TYPES)[number];

const includesQuery = (value: unknown, query: string) =>
  String(value ?? '')
    .toLowerCase()
    .includes(query);

const collectMatchedMetadata = (entity: EntityDbResult, query: string) => {
  const matches: string[] = [];
  if (includesQuery(entity.name, query)) matches.push('name');
  if (includesQuery(entity.slug, query)) matches.push('slug');
  if (includesQuery(entity.description, query)) matches.push('description');
  if (includesQuery(entity.namespace, query)) matches.push('namespace');
  if (includesQuery(entity.owner_name, query)) matches.push('owner');
  if (includesQuery(entity.lifecycle_label, query)) matches.push('lifecycle');
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

const collectMatchedFields = (data: EntityDbResult['data'], query: string) =>
  Object.entries(data)
    .filter(([, value]) => includesQuery(value, query))
    .map(([key]) => key);

const collectFieldMatches = (fields: SchemaField[], query: string) =>
  fields
    .filter(field => includesQuery(field.id, query) || includesQuery(field.name, query))
    .map(field => ({ fieldId: field.id, fieldName: field.name }));

const parseTypesFromString = (value: string | undefined): SearchType[] => {
  if (value == null || value === '') return [...SEARCH_TYPES];
  return [
    ...new Set(
      value
        .split(',')
        .map(type => type.trim())
        .filter((type): type is SearchType => SEARCH_TYPES.includes(type as SearchType))
    )
  ];
};

export const searchWorkspace = async (
  db: DatabaseAdapter,
  workspace: string,
  params: {
    q?: string;
    limitPerType?: number;
    types?: string;
  },
  event: AuthenticatedEvent
) => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);

  const q = params.q?.trim() ?? '';
  const limitPerType = params.limitPerType ?? SEARCH_DEFAULTS.LIMIT_PER_TYPE;
  const types = parseTypesFromString(params.types);

  const empty = { query: q, projects: [], files: [], entities: [], schemas: [] };
  if (q === '') return empty;

  const normalizedQuery = q.toLowerCase();

  const [projects, schemas, entities] = await Promise.all([
    types.includes('projects') || types.includes('files')
      ? db.project.listProjects(ws)
      : Promise.resolve([]),
    types.includes('schemas') || types.includes('entities')
      ? db.catalog.listSchemas(ws)
      : Promise.resolve([]),
    types.includes('entities') ? db.catalog.listEntities(ws) : Promise.resolve([])
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

  const filesResults: Array<{
    projectId: string;
    projectName: string;
    fileId: string;
    path: string;
    name: string;
  }> = [];

  if (types.includes('files')) {
    const projectMap = new Map(visibleProjects.map(project => [project.id, project.name]));
    const projectIds = [...projectMap.keys()];
    const filesByProject = await Promise.all(
      projectIds.map(async projectId => ({
        projectId,
        files: await db.project.listProjectFiles(ws, projectId)
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

  const entityResults = types.includes('entities')
    ? visibleEntities
        .map(entity => {
          const matchedFields = collectMatchedFields(entity.data, normalizedQuery);
          const matchedMetadata = collectMatchedMetadata(entity, normalizedQuery);
          if (matchedFields.length === 0 && matchedMetadata.length === 0) return null;
          return {
            entityId: entity.id,
            schemaId: entity.schema_id,
            schemaName: entity.schema_name,
            _name: entity.name,
            _slug: entity.slug,
            _description: entity.description,
            _owner: entity.owner
              ? { id: entity.owner, name: entity.owner_name ?? entity.owner }
              : null,
            _lifecycle: entity.lifecycle
              ? { id: entity.lifecycle, name: entity.lifecycle_label ?? entity.lifecycle }
              : null,
            _targetLifecycle: entity.target_lifecycle
              ? {
                  id: entity.target_lifecycle,
                  name: entity.target_lifecycle_label ?? entity.target_lifecycle
                }
              : null,
            matchedFields,
            matchedMetadata
          };
        })
        .filter((entity): entity is NonNullable<typeof entity> => entity !== null)
        .sort((a, b) => a._name.localeCompare(b._name))
        .slice(0, limitPerType)
    : [];

  const schemaResults = types.includes('schemas')
    ? schemas
        .map(schema => {
          const fieldMatches = collectFieldMatches(schema.fields, normalizedQuery);
          if (!includesQuery(schema.name, normalizedQuery) && fieldMatches.length === 0)
            return null;
          return { schemaId: schema.id, name: schema.name, fieldMatches };
        })
        .filter((schema): schema is NonNullable<typeof schema> => schema !== null)
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, limitPerType)
    : [];

  return {
    query: q,
    projects: projectsResults,
    files: filesResults.slice(0, limitPerType),
    entities: entityResults,
    schemas: schemaResults
  };
};
