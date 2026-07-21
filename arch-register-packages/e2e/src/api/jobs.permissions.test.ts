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

  await expect(
    personas.workspaceEditor.orpc.jobs.schedules.create({
      params: { workspace: 'default' },
      body: {
        jobType: 'technology-eol',
        schemaId: '00000000-0000-0000-0000-000000000006',
        mapping: {
          productFieldId: 'provider_product',
          cycleFieldId: 'release_cycle',
          latestVersionFieldId: 'latest_version',
          releaseDateFieldId: null,
          supportUntilFieldId: null,
          securityUntilFieldId: null,
          eolDateFieldId: 'eol_date',
          sourceUrlFieldId: null,
          synchronizedAtFieldId: null
        },
        frequency: { unit: 'hours', value: 24 }
      }
    })
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
});
