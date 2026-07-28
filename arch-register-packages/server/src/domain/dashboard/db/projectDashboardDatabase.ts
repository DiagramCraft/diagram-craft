import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { databaseDate, parseDatabaseJson } from '../../../db/rowMappers';

export type ProjectDashboardDbResult = {
  id: string;
  workspace: string;
  project_id: string;
  layout: DashboardWidget[];
  updated_at: Date;
  updated_by: string | null;
};

export const mapProjectDashboardRow = (row: Record<string, unknown>): ProjectDashboardDbResult => ({
  id: String(row['id']),
  workspace: String(row['workspace']),
  project_id: String(row['project_id']),
  layout: parseDatabaseJson<DashboardWidget[]>(row['layout'], [], 'project_dashboard.layout'),
  updated_at: databaseDate(row['updated_at']),
  updated_by: row['updated_by'] == null ? null : String(row['updated_by'])
});

export type ProjectDashboardDbCreate = {
  id: string;
  workspace: string;
  project_id: string;
  updated_by: string | null;
};

export type ProjectDashboardDbUpdate = {
  layout: DashboardWidget[];
  updated_by: string | null;
};

export type ProjectDashboardDatabase = {
  get(workspace: string, projectId: string): Promise<ProjectDashboardDbResult | null>;
  create(input: ProjectDashboardDbCreate): Promise<ProjectDashboardDbResult>;
  update(
    workspace: string,
    projectId: string,
    input: ProjectDashboardDbUpdate
  ): Promise<ProjectDashboardDbResult | null>;
};
