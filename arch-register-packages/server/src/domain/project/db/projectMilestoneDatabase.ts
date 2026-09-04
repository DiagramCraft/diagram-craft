import type { DatabaseRow } from '../../../db/rowMappers';
import { databaseDate, databaseDateOnly } from '../../../db/rowMappers';

export type ProjectMilestoneDbResult = {
  id: string;
  workspace: string;
  project_id: string;
  name: string;
  target_date: string;
  status: 'planned' | 'active' | 'complete' | 'cancelled';
  sort_order: number;
  created_at: Date;
  updated_at: Date;
};

export type ProjectMilestoneDbCreate = ProjectMilestoneDbResult;

export type ProjectMilestoneDbUpdate = Omit<
  ProjectMilestoneDbResult,
  'id' | 'workspace' | 'project_id' | 'created_at'
>;

export const projectMilestoneMapper = (row: DatabaseRow): ProjectMilestoneDbResult => ({
  id: String(row['id']),
  workspace: String(row['workspace']),
  project_id: String(row['project_id']),
  name: String(row['name']),
  target_date: databaseDateOnly(row['target_date']),
  status: row['status'] as ProjectMilestoneDbResult['status'],
  sort_order: Number(row['sort_order'] ?? 0),
  created_at: databaseDate(row['created_at']),
  updated_at: databaseDate(row['updated_at'])
});

export type ProjectMilestoneDatabase = {
  listMilestones(ws: string): Promise<ProjectMilestoneDbResult[]>;
  getMilestone(ws: string, projectId: string, id: string): Promise<ProjectMilestoneDbResult | null>;
  getMilestoneById(ws: string, id: string): Promise<ProjectMilestoneDbResult | null>;
  createMilestone(input: ProjectMilestoneDbCreate): Promise<ProjectMilestoneDbResult>;
  updateMilestone(
    ws: string,
    projectId: string,
    id: string,
    input: ProjectMilestoneDbUpdate
  ): Promise<ProjectMilestoneDbResult | null>;
  deleteMilestone(
    ws: string,
    projectId: string,
    id: string
  ): Promise<ProjectMilestoneDbResult | null>;
};
