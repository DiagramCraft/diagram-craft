import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type {
  CreateDashboardRequest,
  UpdateDashboardRequest,
  PersonalDashboard as ApiPersonalDashboard
} from '@arch-register/api-types/dashboardContract';
import type { UserDashboardDbResult } from './db/personalDashboardDatabase';
import { httpAssert } from '../../utils/httpAssert';

export const toApi = (row: UserDashboardDbResult): ApiPersonalDashboard => ({
  id: row.id,
  workspaceId: row.workspace,
  name: row.name,
  order: row.sort_order,
  widgets: row.layout,
  updatedAt: row.updated_at.toISOString()
});

const nextSortOrder = (existing: UserDashboardDbResult[]): number =>
  existing.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1;

export const listPersonalDashboards = async (
  db: DatabaseAdapter,
  userId: string,
  workspace: string
): Promise<ApiPersonalDashboard[]> => {
  const rows = await db.personalDashboard.list(userId, workspace);
  return rows.map(toApi);
};

export const getPersonalDashboard = async (
  db: DatabaseAdapter,
  userId: string,
  workspace: string,
  id: string
): Promise<ApiPersonalDashboard> => {
  const row = await db.personalDashboard.get(userId, workspace, id);
  httpAssert.present(row, { status: 404, message: 'Dashboard not found' });
  return toApi(row!);
};

export const createPersonalDashboard = async (
  db: DatabaseAdapter,
  userId: string,
  workspace: string,
  body: CreateDashboardRequest
): Promise<ApiPersonalDashboard> => {
  httpAssert.true(body.name, { status: 400, message: 'Name is required' });

  const existing = await db.personalDashboard.list(userId, workspace);
  const row = await db.personalDashboard.create({
    id: randomUUID(),
    user_id: userId,
    workspace,
    name: body.name,
    sort_order: nextSortOrder(existing)
  });
  return toApi(row);
};

export const updatePersonalDashboard = async (
  db: DatabaseAdapter,
  userId: string,
  workspace: string,
  id: string,
  body: UpdateDashboardRequest
): Promise<ApiPersonalDashboard> => {
  const existing = await db.personalDashboard.get(userId, workspace, id);
  httpAssert.present(existing, { status: 404, message: 'Dashboard not found' });

  const updated = await db.personalDashboard.update(userId, workspace, id, {
    name: body.name,
    layout: body.widgets
  });
  httpAssert.present(updated, { status: 404, message: 'Dashboard not found' });
  return toApi(updated!);
};

export const deletePersonalDashboard = async (
  db: DatabaseAdapter,
  userId: string,
  workspace: string,
  id: string
): Promise<{ success: boolean }> => {
  const existing = await db.personalDashboard.get(userId, workspace, id);
  httpAssert.present(existing, { status: 404, message: 'Dashboard not found' });

  await db.personalDashboard.remove(userId, workspace, id);

  return { success: true };
};
