import { randomUUID } from 'node:crypto';
import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';
import { seedIds } from '../helpers/seedHelper';

const test = createPermissionApiTest();

test('job monitoring is restricted to workspace administrators', async ({ server, personas }) => {
  const now = new Date('2026-06-01T00:00:00.000Z');
  await server.db.jobs.createSchedule({
    id: randomUUID(),
    workspace: seedIds.workspace.default,
    job_type: 'scheduled-import',
    system_identity: 'system.importer',
    payload: {},
    priority: 5,
    recurrence: { type: 'hours', intervalHours: 1, startsAt: now },
    enabled: true,
    next_occurrence_at: now,
    created_at: now,
    updated_at: now
  });
  await server.db.jobs.materializeDueSchedules(now);

  const schedules = await personas.workspaceAdmin.orpc.jobs.schedules.list({
    params: { workspace: 'default' }
  });
  expect(schedules.length).toBeGreaterThan(0);

  await expect(
    personas.workspaceEditor.orpc.jobs.schedules.list({ params: { workspace: 'default' } })
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  await expect(
    personas.workspaceEditor.orpc.jobs.runs.list({
      params: { workspace: 'default' },
      query: {}
    })
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
});
