import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type {
  ProjectDashboard as ApiProjectDashboard,
  UpdateProjectDashboardRequest
} from '@arch-register/api-types/dashboardContract';
import type { ProjectDashboardDbResult } from './db/projectDashboardDatabase';
import { httpAssert } from '../../utils/httpAssert';

const DEFAULT_SEEDED_WIDGETS: ApiProjectDashboard['widgets'] = [
  {
    id: 'default-entity-count',
    type: 'Metric',
    config: { metricType: 'entity-count' },
    x: 0,
    y: 0,
    w: 3,
    h: 2
  },
  {
    id: 'default-diagram-count',
    type: 'Metric',
    config: { metricType: 'diagram-count' },
    x: 3,
    y: 0,
    w: 3,
    h: 2
  },
  {
    id: 'default-active-assessments',
    type: 'active-assessments',
    config: {},
    x: 6,
    y: 0,
    w: 3,
    h: 2
  },
  {
    id: 'default-upcoming-milestones',
    type: 'upcoming-milestones',
    config: {},
    x: 9,
    y: 0,
    w: 3,
    h: 2
  },
  { id: 'default-entity-table', type: 'EntityTable', config: {}, x: 0, y: 2, w: 12, h: 6 }
];

export const toApi = (row: ProjectDashboardDbResult): ApiProjectDashboard => ({
  id: row.id,
  workspaceId: row.workspace,
  projectId: row.project_id,
  widgets: row.layout,
  updatedAt: row.updated_at.toISOString(),
  updatedBy: row.updated_by
});

export const getOrSeedProjectDashboard = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string
): Promise<ApiProjectDashboard> => {
  const existing = await db.projectDashboard.get(workspace, projectId);
  if (existing) return toApi(existing);

  const seeded = await db.projectDashboard.create({
    id: randomUUID(),
    workspace,
    project_id: projectId,
    updated_by: null
  });
  const withDefaults = await db.projectDashboard.update(workspace, projectId, {
    layout: DEFAULT_SEEDED_WIDGETS,
    updated_by: null
  });
  return toApi(withDefaults ?? seeded);
};

export const updateProjectDashboard = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  body: UpdateProjectDashboardRequest,
  actorUserId: string | null
): Promise<ApiProjectDashboard> => {
  await getOrSeedProjectDashboard(db, workspace, projectId);

  const updated = await db.projectDashboard.update(workspace, projectId, {
    layout: body.widgets,
    updated_by: actorUserId
  });
  httpAssert.present(updated, { status: 404, message: 'Project dashboard not found' });
  return toApi(updated!);
};
