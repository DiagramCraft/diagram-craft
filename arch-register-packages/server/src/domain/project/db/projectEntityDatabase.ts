import type { DatabaseRow } from '../../../db/rowMappers';
import { databaseBoolean, databaseDate } from '../../../db/rowMappers';
import type { ProjectDbResult } from './projectCrudDatabase';
import { projectMapper } from './projectCrudDatabase';

export const PROJECT_ENTITY_SELECT_SQL = `
  SELECT
    pe.workspace,
    pe.project_id,
    pe.entity_id,
    e.name        AS entity_name,
    e.slug        AS entity_slug,
    e.description AS entity_description,
    e.schema_id   AS entity_schema_id,
    es.name       AS entity_schema_name,
    pe.entity_type AS entity_type_id,
    pet.label     AS entity_type_label,
    pe.is_done
  FROM project_entity pe
  JOIN catalog_record e ON e.id = pe.entity_id AND e.kind = 'entity' AND e.deleted_at IS NULL
  LEFT JOIN entity_schema es ON es.id = e.schema_id
  LEFT JOIN project_entity_type pet ON pet.id = pe.entity_type AND pet.workspace = pe.workspace
`;

export type ProjectEntityDbResult = {
  workspace: string;
  project_id: string;
  entity_id: string;
  entity_name: string;
  entity_slug: string;
  entity_description: string;
  entity_schema_id: string | null;
  entity_schema_name: string | null;
  entity_type_id: string | null;
  entity_type_label: string | null;
  is_done: boolean;
};

export type ProjectEntityLinkDbResult = {
  entity_id: string;
  created_at: Date;
};

export type ProjectEntityDbCreate = {
  workspace: string;
  project_id: string;
  entity_id: string;
  entity_type_id: string | null;
  is_done?: boolean;
  created_at: Date;
};

export type EntityProjectDbResult = {
  project: ProjectDbResult;
  file_count: number;
  entity_type_id: string | null;
  entity_type_label: string | null;
};

export const projectEntityMapper = (row: DatabaseRow): ProjectEntityDbResult => ({
  workspace: String(row['workspace']),
  project_id: String(row['project_id']),
  entity_id: String(row['entity_id']),
  entity_name: String(row['entity_name']),
  entity_slug: String(row['entity_slug']),
  entity_description: String(row['entity_description'] ?? ''),
  entity_schema_id: row['entity_schema_id'] == null ? null : String(row['entity_schema_id']),
  entity_schema_name: row['entity_schema_name'] == null ? null : String(row['entity_schema_name']),
  entity_type_id: row['entity_type_id'] == null ? null : String(row['entity_type_id']),
  entity_type_label: row['entity_type_label'] == null ? null : String(row['entity_type_label']),
  is_done: databaseBoolean(row['is_done'])
});

export const projectEntityLinkMapper = (row: DatabaseRow): ProjectEntityLinkDbResult => ({
  entity_id: String(row['entity_id']),
  created_at: databaseDate(row['created_at'])
});

export const entityProjectMapper = (row: DatabaseRow): EntityProjectDbResult => ({
  project: projectMapper(row),
  file_count: Number(row['file_count'] ?? 0),
  entity_type_id: row['entity_type_id'] == null ? null : String(row['entity_type_id']),
  entity_type_label: row['entity_type_label'] == null ? null : String(row['entity_type_label'])
});

export type ProjectEntityDatabase = {
  listProjectEntities(ws: string, projectId: string): Promise<ProjectEntityDbResult[]>;
  listProjectEntityLinks(ws: string, projectId: string): Promise<ProjectEntityLinkDbResult[]>;
  addProjectEntity(input: ProjectEntityDbCreate): Promise<ProjectEntityDbResult>;
  updateProjectEntity(
    ws: string,
    projectId: string,
    entityId: string,
    entityTypeId: string | null,
    isDone: boolean
  ): Promise<ProjectEntityDbResult | null>;
  removeProjectEntity(ws: string, projectId: string, entityId: string): Promise<void>;
  getEntityProjects(ws: string, entityId: string): Promise<EntityProjectDbResult[]>;
  isEntityLinkedToProject(ws: string, projectId: string, entityId: string): Promise<boolean>;
};
