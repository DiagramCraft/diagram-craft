import type { DatabaseAdapter } from '../../db/database';
import type {
  DashboardWidget,
  WorkspaceDashboard as ApiWorkspaceDashboard
} from '@arch-register/api-types/dashboardContract';
import type { WorkspaceDashboardDbResult } from './db/dashboardDatabase';

export const toApi = (
  workspace: string,
  row: WorkspaceDashboardDbResult | null
): ApiWorkspaceDashboard =>
  row == null
    ? { workspaceId: workspace, widgets: [], updatedAt: null, updatedBy: null }
    : {
        workspaceId: row.workspace,
        widgets: row.layout,
        updatedAt: row.updated_at.toISOString(),
        updatedBy: row.updated_by
      };

export const getWorkspaceDashboard = async (
  db: DatabaseAdapter,
  workspace: string
): Promise<ApiWorkspaceDashboard> => {
  const row = await db.dashboard.get(workspace);
  return toApi(workspace, row);
};

export const putWorkspaceDashboard = async (
  db: DatabaseAdapter,
  workspace: string,
  widgets: DashboardWidget[],
  actorUserId: string | null
): Promise<ApiWorkspaceDashboard> => {
  const row = await db.dashboard.put(workspace, widgets, actorUserId);
  return toApi(workspace, row);
};
