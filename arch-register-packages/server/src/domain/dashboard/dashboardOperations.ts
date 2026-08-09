import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type {
  CreateDashboardRequest,
  UpdateDashboardRequest,
  WorkspaceDashboard as ApiWorkspaceDashboard
} from '@arch-register/api-types/dashboardContract';
import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import type { WorkspaceDashboardDbResult } from './db/dashboardDatabase';
import { httpAssert } from '../../utils/httpAssert';

export const toApi = (row: WorkspaceDashboardDbResult): ApiWorkspaceDashboard => ({
  id: row.id,
  workspaceId: row.workspace,
  name: row.name,
  order: row.sort_order,
  widgets: row.layout,
  updatedAt: row.updated_at.toISOString(),
  updatedBy: row.updated_by
});

const nextSortOrder = (existing: WorkspaceDashboardDbResult[]): number =>
  existing.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1;

export const replaceDefaultWorkspaceDashboardLayout = async (
  db: DatabaseAdapter,
  workspace: string,
  widgets: DashboardWidget[],
  updatedBy: string | null
): Promise<WorkspaceDashboardDbResult> => {
  const existing = await db.dashboard.list(workspace);
  const dashboard =
    existing[0] ??
    (await db.dashboard.create({
      id: randomUUID(),
      workspace,
      name: 'Overview',
      sort_order: 0,
      updated_by: updatedBy
    }));
  return (await db.dashboard.update(workspace, dashboard.id, {
    layout: widgets,
    updated_by: updatedBy
  }))!;
};

export const listWorkspaceDashboards = async (
  db: DatabaseAdapter,
  workspace: string
): Promise<ApiWorkspaceDashboard[]> => {
  const rows = await db.dashboard.list(workspace);
  if (rows.length > 0) return rows.map(toApi);

  const seeded = await db.dashboard.create({
    id: randomUUID(),
    workspace,
    name: 'Overview',
    sort_order: 0,
    updated_by: null
  });
  return [toApi(seeded)];
};

export const getWorkspaceDashboard = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string
): Promise<ApiWorkspaceDashboard> => {
  const row = await db.dashboard.get(workspace, id);
  httpAssert.present(row, { status: 404, message: 'Dashboard not found' });
  return toApi(row!);
};

export const createWorkspaceDashboard = async (
  db: DatabaseAdapter,
  workspace: string,
  body: CreateDashboardRequest,
  actorUserId: string | null
): Promise<ApiWorkspaceDashboard> => {
  httpAssert.true(body.name, { status: 400, message: 'Name is required' });

  const existing = await db.dashboard.list(workspace);
  const row = await db.dashboard.create({
    id: randomUUID(),
    workspace,
    name: body.name,
    sort_order: nextSortOrder(existing),
    updated_by: actorUserId
  });
  return toApi(row);
};

export const updateWorkspaceDashboard = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  body: UpdateDashboardRequest,
  actorUserId: string | null
): Promise<ApiWorkspaceDashboard> => {
  const existing = await db.dashboard.get(workspace, id);
  httpAssert.present(existing, { status: 404, message: 'Dashboard not found' });

  const updated = await db.dashboard.update(workspace, id, {
    name: body.name,
    layout: body.widgets,
    updated_by: actorUserId
  });
  httpAssert.present(updated, { status: 404, message: 'Dashboard not found' });
  return toApi(updated!);
};

export const deleteWorkspaceDashboard = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string
): Promise<{ success: boolean }> => {
  const all = await db.dashboard.list(workspace);
  const existing = all.find(row => row.id === id);
  httpAssert.present(existing, { status: 404, message: 'Dashboard not found' });
  httpAssert.true(all.length > 1, {
    status: 400,
    message: 'Cannot delete the only dashboard in a workspace'
  });

  await db.dashboard.remove(workspace, id);

  return { success: true };
};
