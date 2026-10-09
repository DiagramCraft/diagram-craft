import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type {
  CreateApplicationRequest,
  WorkspaceApplication as ApiWorkspaceApplication
} from '@arch-register/api-types/applicationContract';
import type { WorkspaceApplicationDbResult } from './db/applicationDatabase';
import type { WorkspaceDashboardDbResult } from '../dashboard/db/dashboardDatabase';
import { httpAssert } from '../../utils/httpAssert';

export const toApiApplication = (row: WorkspaceApplicationDbResult): ApiWorkspaceApplication => ({
  id: row.id,
  workspaceId: row.workspace,
  key: row.key,
  name: row.name,
  description: row.description,
  accentColor: row.accent_color,
  order: row.sort_order,
  updatedAt: row.updated_at.toISOString(),
  updatedBy: row.updated_by
});

/** Creates an application together with its default "Overview" dashboard. */
export const createApplication = async (
  db: DatabaseAdapter,
  workspace: string,
  body: CreateApplicationRequest,
  actorUserId: string | null
): Promise<{ application: WorkspaceApplicationDbResult; overview: WorkspaceDashboardDbResult }> => {
  httpAssert.true(body.key, { status: 400, message: 'Key is required' });
  httpAssert.true(body.name, { status: 400, message: 'Name is required' });

  return db.core.transaction(async tx => {
    const existing = await tx.application.list(workspace);
    const application = await tx.application.create({
      id: randomUUID(),
      workspace,
      key: body.key,
      name: body.name,
      description: body.description,
      accent_color: body.accentColor ?? null,
      sort_order: existing.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1,
      updated_by: actorUserId
    });
    const overview = await tx.dashboard.create({
      id: randomUUID(),
      workspace,
      name: 'Overview',
      sort_order: 0,
      application_id: application.id,
      application_order: 0,
      updated_by: actorUserId
    });
    return { application, overview };
  });
};

export const addDashboardToApplication = async (
  db: DatabaseAdapter,
  workspace: string,
  applicationId: string,
  input: { name: string; icon?: string | null; railLabel?: string | null },
  actorUserId: string | null
): Promise<WorkspaceDashboardDbResult> => {
  const application = await db.application.get(workspace, applicationId);
  httpAssert.present(application, { status: 404, message: 'Application not found' });

  const siblings = await db.dashboard.listByApplication(workspace, applicationId);
  const next = siblings.reduce((max, row) => Math.max(max, row.application_order ?? -1), -1) + 1;
  return db.dashboard.create({
    id: randomUUID(),
    workspace,
    name: input.name,
    sort_order: next,
    application_id: applicationId,
    application_order: next,
    icon: input.icon ?? null,
    rail_label: input.railLabel ?? null,
    updated_by: actorUserId
  });
};

export const removeDashboardFromApplication = async (
  db: DatabaseAdapter,
  workspace: string,
  applicationId: string,
  dashboardId: string
): Promise<void> => {
  const siblings = await db.dashboard.listByApplication(workspace, applicationId);
  httpAssert.present(
    siblings.find(row => row.id === dashboardId),
    { status: 404, message: 'Dashboard not found in application' }
  );
  httpAssert.true(siblings.length > 1, {
    status: 400,
    message: 'Cannot remove the only dashboard in an application'
  });
  await db.dashboard.remove(workspace, dashboardId);
};

export const reorderApplicationDashboards = async (
  db: DatabaseAdapter,
  workspace: string,
  applicationId: string,
  orderedDashboardIds: string[],
  actorUserId: string | null
): Promise<WorkspaceDashboardDbResult[]> => {
  const siblings = await db.dashboard.listByApplication(workspace, applicationId);
  const ids = new Set(siblings.map(row => row.id));
  httpAssert.true(
    orderedDashboardIds.length === ids.size && orderedDashboardIds.every(id => ids.has(id)),
    { status: 400, message: 'Order must list every dashboard of the application exactly once' }
  );
  await db.core.transaction(async tx => {
    for (const [index, id] of orderedDashboardIds.entries()) {
      await tx.dashboard.update(workspace, id, { application_order: index, updated_by: actorUserId });
    }
  });
  return db.dashboard.listByApplication(workspace, applicationId);
};
