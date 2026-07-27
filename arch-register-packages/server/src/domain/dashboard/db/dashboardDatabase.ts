import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { databaseDate, parseDatabaseJson } from '../../../db/rowMappers';

export type WorkspaceDashboardDbResult = {
  id: string;
  workspace: string;
  layout: DashboardWidget[];
  updated_at: Date;
  updated_by: string | null;
};

export const mapWorkspaceDashboardRow = (
  row: Record<string, unknown>
): WorkspaceDashboardDbResult => ({
  id: String(row['id']),
  workspace: String(row['workspace']),
  layout: parseDatabaseJson<DashboardWidget[]>(row['layout'], [], 'workspace_dashboard.layout'),
  updated_at: databaseDate(row['updated_at']),
  updated_by: row['updated_by'] == null ? null : String(row['updated_by'])
});

export type DashboardDatabase = {
  get(workspace: string): Promise<WorkspaceDashboardDbResult | null>;
  put(
    workspace: string,
    widgets: DashboardWidget[],
    actorUserId: string | null
  ): Promise<WorkspaceDashboardDbResult>;
};
