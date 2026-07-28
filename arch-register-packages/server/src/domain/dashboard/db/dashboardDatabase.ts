import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { databaseDate, parseDatabaseJson } from '../../../db/rowMappers';

export type WorkspaceDashboardDbResult = {
  id: string;
  workspace: string;
  name: string;
  sort_order: number;
  layout: DashboardWidget[];
  updated_at: Date;
  updated_by: string | null;
};

export const mapWorkspaceDashboardRow = (
  row: Record<string, unknown>
): WorkspaceDashboardDbResult => ({
  id: String(row['id']),
  workspace: String(row['workspace']),
  name: String(row['name']),
  sort_order: Number(row['sort_order']),
  layout: parseDatabaseJson<DashboardWidget[]>(row['layout'], [], 'workspace_dashboard.layout'),
  updated_at: databaseDate(row['updated_at']),
  updated_by: row['updated_by'] == null ? null : String(row['updated_by'])
});

export type DashboardDbCreate = {
  id: string;
  workspace: string;
  name: string;
  sort_order: number;
  updated_by: string | null;
};

export type DashboardDbUpdate = {
  name?: string;
  layout?: DashboardWidget[];
  updated_by: string | null;
};

export type DashboardDatabase = {
  list(workspace: string): Promise<WorkspaceDashboardDbResult[]>;
  get(workspace: string, id: string): Promise<WorkspaceDashboardDbResult | null>;
  create(input: DashboardDbCreate): Promise<WorkspaceDashboardDbResult>;
  update(
    workspace: string,
    id: string,
    input: DashboardDbUpdate
  ): Promise<WorkspaceDashboardDbResult | null>;
  remove(workspace: string, id: string): Promise<WorkspaceDashboardDbResult | null>;
};
