import type { DatabaseRow } from '../../../db/rowMappers';
import { databaseBoolean, databaseDate } from '../../../db/rowMappers';

export const PROJECT_SELECT_SQL = `
  SELECT p.*, wo.name AS owner_name
  FROM project p
  LEFT JOIN workspace_owner wo ON wo.id = p.owner
`;

type BaseProject = {
  id: string;
  workspace: string;
  public_id?: string;
  name: string;
  description: string;
  owner: string | null;
  status: 'draft' | 'active' | 'complete' | 'cancelled';
  color: string | null;
  start_date: string | null;
  target_date: string | null;
  pinned: boolean;
  created_at: Date;
  updated_at: Date;
};

export type ProjectDbResult = BaseProject & {
  owner_name: string | null;
};

export type ProjectDbCreate = BaseProject;

export type ProjectDbUpdate = Omit<BaseProject, 'id' | 'workspace' | 'created_at'>;

export const projectMapper = (row: DatabaseRow): ProjectDbResult => ({
  id: String(row['id']),
  workspace: String(row['workspace']),
  public_id: String(row['public_id']),
  name: String(row['name']),
  description: String(row['description']),
  owner: row['owner'] == null ? null : String(row['owner']),
  status: String(row['status']) as ProjectDbResult['status'],
  color: row['color'] == null ? null : String(row['color']),
  start_date: row['start_date'] == null ? null : String(row['start_date']),
  target_date: row['target_date'] == null ? null : String(row['target_date']),
  pinned: databaseBoolean(row['pinned']),
  created_at: databaseDate(row['created_at']),
  updated_at: databaseDate(row['updated_at']),
  owner_name: row['owner_name'] == null ? null : String(row['owner_name'])
});

export type ProjectCrudDatabase = {
  listProjects(ws: string): Promise<ProjectDbResult[]>;
  getProject(ws: string, identifier: string): Promise<ProjectDbResult | null>;
  createProject(input: ProjectDbCreate): Promise<ProjectDbResult>;
  updateProject(ws: string, id: string, input: ProjectDbUpdate): Promise<ProjectDbResult | null>;
  deleteProject(ws: string, id: string): Promise<void>;
};
