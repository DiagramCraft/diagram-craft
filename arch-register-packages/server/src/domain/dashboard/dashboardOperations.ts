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
import { addDashboardToApplication } from '../application/applicationOperations';
import { dashboardKeyFromName, isValidDashboardKey, uniqueDashboardKey } from './dashboardKey';

export const toApi = (row: WorkspaceDashboardDbResult): ApiWorkspaceDashboard => ({
  id: row.id,
  workspaceId: row.workspace,
  name: row.name,
  key: row.key,
  description: row.description,
  order: row.sort_order,
  widgets: row.layout,
  updatedAt: row.updated_at.toISOString(),
  updatedBy: row.updated_by,
  appKey: row.app_key,
  applicationId: row.application_id,
  applicationOrder: row.application_order,
  icon: row.icon,
  railLabel: row.rail_label,
  sidebar: row.sidebar ?? undefined
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
      key: await uniqueDashboardKey(db, workspace, null, 'overview'),
      sort_order: 0,
      updated_by: updatedBy
    }));
  return (await db.dashboard.update(workspace, dashboard.id, {
    layout: widgets,
    updated_by: updatedBy
  }))!;
};

export const appendWorkspaceDashboardLayout = async (
  db: DatabaseAdapter,
  workspace: string,
  name: string,
  widgets: DashboardWidget[],
  updatedBy: string | null
): Promise<WorkspaceDashboardDbResult> => {
  const existing = await db.dashboard.list(workspace);
  if (!existing.some(row => row.name.toLocaleLowerCase() === 'overview')) {
    await db.dashboard.create({
      id: randomUUID(),
      workspace,
      name: 'Overview',
      key: await uniqueDashboardKey(db, workspace, null, 'overview'),
      sort_order: existing.length === 0 ? 0 : nextSortOrder(existing),
      updated_by: updatedBy
    });
  }
  const refreshed = await db.dashboard.list(workspace);
  const names = new Set(refreshed.map(row => row.name.toLocaleLowerCase()));
  const baseName = name.trim() || 'Dashboard';
  let dashboardName = baseName;
  let suffix = 2;
  while (names.has(dashboardName.toLocaleLowerCase())) {
    dashboardName = `${baseName} (${suffix})`;
    suffix += 1;
  }
  const created = await db.dashboard.create({
    id: randomUUID(),
    workspace,
    name: dashboardName,
    key: await uniqueDashboardKey(db, workspace, null, dashboardKeyFromName(dashboardName)),
    sort_order: nextSortOrder(refreshed),
    updated_by: updatedBy
  });
  return (await db.dashboard.update(workspace, created.id, {
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
    key: await uniqueDashboardKey(db, workspace, null, 'overview'),
    sort_order: 0,
    updated_by: null
  });
  return [toApi(seeded)];
};

export const getAppDashboard = async (
  db: DatabaseAdapter,
  workspace: string,
  appKey: string
): Promise<ApiWorkspaceDashboard> => {
  const existing = await db.dashboard.getByAppKey(workspace, appKey);
  httpAssert.present(existing, {
    status: 404,
    message: 'App dashboard not found'
  });
  return toApi(existing!);
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

/** Resolves a dashboard by key within an application, or among home dashboards when `applicationId` is null. */
export const getWorkspaceDashboardByKey = async (
  db: DatabaseAdapter,
  workspace: string,
  applicationId: string | null,
  key: string
): Promise<ApiWorkspaceDashboard> => {
  const row = await db.dashboard.getByKey(workspace, applicationId, key);
  httpAssert.present(row, { status: 404, message: 'Dashboard not found' });
  return toApi(row!);
};

const assertValidKey = (key: string | undefined) =>
  httpAssert.true(key === undefined || isValidDashboardKey(key), {
    status: 400,
    message: 'Key must be a lowercase slug (letters, digits and single hyphens)'
  });

const assertKeyAvailable = async (
  db: DatabaseAdapter,
  workspace: string,
  applicationId: string | null,
  key: string,
  excludeId?: string
) => {
  const clash = await db.dashboard.getByKey(workspace, applicationId, key);
  httpAssert.true(!clash || clash.id === excludeId, {
    status: 409,
    message: `A dashboard with key '${key}' already exists`
  });
};

const assertValidIcon = (icon: string | null | undefined) =>
  httpAssert.true(icon == null || /^Tb[A-Za-z0-9]{1,60}$/.test(icon), {
    status: 400,
    message: 'Invalid icon name'
  });

export const createWorkspaceDashboard = async (
  db: DatabaseAdapter,
  workspace: string,
  body: CreateDashboardRequest,
  actorUserId: string | null
): Promise<ApiWorkspaceDashboard> => {
  httpAssert.true(body.name, { status: 400, message: 'Name is required' });
  assertValidIcon(body.icon);
  assertValidKey(body.key);

  if (body.applicationId) {
    const row = await addDashboardToApplication(
      db,
      workspace,
      body.applicationId,
      { name: body.name, key: body.key, icon: body.icon },
      actorUserId
    );
    if (!body.description) return toApi(row);
    const described = await db.dashboard.update(workspace, row.id, {
      description: body.description,
      updated_by: actorUserId
    });
    return toApi(described ?? row);
  }

  const existing = await db.dashboard.list(workspace);
  if (body.key) await assertKeyAvailable(db, workspace, null, body.key);
  const row = await db.dashboard.create({
    id: randomUUID(),
    workspace,
    name: body.name,
    key:
      body.key ?? (await uniqueDashboardKey(db, workspace, null, dashboardKeyFromName(body.name))),
    description: body.description,
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
  assertValidIcon(body.icon);
  assertValidKey(body.key);
  const existing = await db.dashboard.get(workspace, id);
  httpAssert.present(existing, { status: 404, message: 'Dashboard not found' });
  if (body.key && body.key !== existing!.key) {
    await assertKeyAvailable(db, workspace, existing!.application_id, body.key, id);
  }

  const updated = await db.dashboard.update(workspace, id, {
    name: body.name,
    key: body.key,
    description: body.description,
    ...('icon' in body ? { icon: body.icon ?? null } : {}),
    ...('railLabel' in body ? { rail_label: body.railLabel ?? null } : {}),
    layout: body.widgets,
    ...('sidebar' in body ? { sidebar: body.sidebar ?? null } : {}),
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
  const target = await db.dashboard.get(workspace, id);
  httpAssert.present(target, { status: 404, message: 'Dashboard not found' });
  if (target!.application_id) {
    const siblings = await db.dashboard.listByApplication(workspace, target!.application_id);
    httpAssert.true(siblings.length > 1, {
      status: 400,
      message: 'Cannot delete the only dashboard in an application'
    });
    await db.dashboard.remove(workspace, id);
    return { success: true };
  }

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
