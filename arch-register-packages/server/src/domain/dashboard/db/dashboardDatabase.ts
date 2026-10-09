import type {
  DashboardSidebarConfig,
  DashboardWidget
} from '@arch-register/api-types/dashboardContract';
import { databaseDate, parseDatabaseJson } from '../../../db/rowMappers';

export type WorkspaceDashboardDbResult = {
  id: string;
  workspace: string;
  name: string;
  description: string;
  sort_order: number;
  app_key: string | null;
  application_id: string | null;
  application_order: number | null;
  icon: string | null;
  rail_label: string | null;
  layout: DashboardWidget[];
  sidebar: DashboardSidebarConfig | null;
  updated_at: Date;
  updated_by: string | null;
};

export const mapWorkspaceDashboardRow = (
  row: Record<string, unknown>
): WorkspaceDashboardDbResult => ({
  id: String(row['id']),
  workspace: String(row['workspace']),
  name: String(row['name']),
  description: String(row['description'] ?? ''),
  sort_order: Number(row['sort_order']),
  app_key: row['app_key'] == null ? null : String(row['app_key']),
  application_id: row['application_id'] == null ? null : String(row['application_id']),
  application_order: row['application_order'] == null ? null : Number(row['application_order']),
  icon: row['icon'] == null ? null : String(row['icon']),
  rail_label: row['rail_label'] == null ? null : String(row['rail_label']),
  layout: parseDatabaseJson<DashboardWidget[]>(row['layout'], [], 'workspace_dashboard.layout'),
  sidebar: parseDatabaseJson<DashboardSidebarConfig | null>(
    row['sidebar'],
    null,
    'workspace_dashboard.sidebar'
  ),
  updated_at: databaseDate(row['updated_at']),
  updated_by: row['updated_by'] == null ? null : String(row['updated_by'])
});

export type DashboardDbCreate = {
  id: string;
  workspace: string;
  name: string;
  description?: string;
  sort_order: number;
  app_key?: string | null;
  application_id?: string | null;
  application_order?: number | null;
  icon?: string | null;
  rail_label?: string | null;
  updated_by: string | null;
};

export type DashboardDbUpdate = {
  name?: string;
  description?: string;
  application_order?: number | null;
  /** Present (including `null`) means "set"; absent means "leave unchanged". */
  icon?: string | null;
  /** Present (including `null`) means "set"; absent means "leave unchanged". */
  rail_label?: string | null;
  layout?: DashboardWidget[];
  /** Present (including `null`) means "set"; absent means "leave unchanged". */
  sidebar?: DashboardSidebarConfig | null;
  updated_by: string | null;
};

export type DashboardDatabase = {
  list(workspace: string): Promise<WorkspaceDashboardDbResult[]>;
  listByApplication(workspace: string, applicationId: string): Promise<WorkspaceDashboardDbResult[]>;
  getByAppKey(workspace: string, appKey: string): Promise<WorkspaceDashboardDbResult | null>;
  get(workspace: string, id: string): Promise<WorkspaceDashboardDbResult | null>;
  create(input: DashboardDbCreate): Promise<WorkspaceDashboardDbResult>;
  update(
    workspace: string,
    id: string,
    input: DashboardDbUpdate
  ): Promise<WorkspaceDashboardDbResult | null>;
  remove(workspace: string, id: string): Promise<WorkspaceDashboardDbResult | null>;
};
