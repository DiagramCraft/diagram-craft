import { randomUUID } from 'node:crypto';
import { createApiTest, createTestORPCClient, expect } from '../helpers/fixtures';
import { seedIds } from '../helpers/seedHelper';
import type { JobScheduleDbCreate } from '@arch-register/server/db/database';

const now = new Date('2026-06-01T00:00:00.000Z');

const makeSchedule = (overrides: Partial<JobScheduleDbCreate> = {}): JobScheduleDbCreate => ({
  id: randomUUID(),
  workspace: seedIds.workspace.default,
  job_type: 'scheduled-import',
  system_identity: 'system.importer',
  payload: { source: 'e2e' },
  priority: 3,
  recurrence: { type: 'hours', intervalHours: 1, startsAt: now },
  enabled: true,
  next_occurrence_at: now,
  created_at: now,
  updated_at: now,
  ...overrides
});

const test = createApiTest({
  afterSeed: async server => {
    await server.db.jobs.createSchedule(makeSchedule());
    await server.db.jobs.materializeDueSchedules(now);
    await server.db.jobs.registerServer({
      id: 'e2e-worker',
      name: 'E2E job server',
      instance_id: randomUUID(),
      status: 'available',
      last_seen_at: new Date()
    });
    await server.db.jobs.registerServer({
      id: 'stale-worker',
      name: 'Stale job server',
      instance_id: randomUUID(),
      status: 'available',
      last_seen_at: new Date('2020-01-01T00:00:00.000Z')
    });
  }
});

test.describe('workspace job monitoring', () => {
  test('lists schedules and paginated run history', async ({ orpc }) => {
    const schedules = await orpc.jobs.schedules.list({ params: { workspace: 'default' } });
    expect(schedules).toHaveLength(1);
    expect(schedules[0]).toMatchObject({
      job_type: 'scheduled-import',
      system_identity: 'system.importer',
      priority: 3,
      enabled: true
    });

    const page = await orpc.jobs.runs.list({
      params: { workspace: 'default' },
      query: { limit: 1, offset: 0 }
    });
    expect(page.total).toBe(1);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      status: 'queued',
      job_type: 'scheduled-import',
      worker_id: null,
      started_at: null,
      completed_at: null
    });
    expect(page.items[0]?.queue_delay_ms).toBeGreaterThanOrEqual(0);
  });

  test('lists job servers and derives stale servers as unavailable', async ({ orpc }) => {
    const servers = await orpc.jobs.servers.list({ params: { workspace: 'default' } });

    expect(servers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'e2e-worker',
          name: 'E2E job server',
          status: 'available'
        }),
        expect.objectContaining({
          id: 'stale-worker',
          name: 'Stale job server',
          status: 'unavailable'
        })
      ])
    );
  });

  test('cancels a queued run without disabling its schedule', async ({ orpc }) => {
    const page = await orpc.jobs.runs.list({
      params: { workspace: 'default' },
      query: { status: 'queued' }
    });
    const run = page.items[0]!;

    const cancelled = await orpc.jobs.runs.cancel({
      params: { workspace: 'default', id: run.id }
    });
    expect(cancelled).toMatchObject({ id: run.id, status: 'cancelled' });

    const schedules = await orpc.jobs.schedules.list({ params: { workspace: 'default' } });
    expect(schedules[0]?.enabled).toBe(true);
  });

  test('rejects cancellation of a running run', async ({ server, orpc }) => {
    const schedule = await server.db.jobs.createSchedule(
      makeSchedule({
        id: randomUUID(),
        next_occurrence_at: now,
        created_at: new Date(now.getTime() + 1),
        updated_at: new Date(now.getTime() + 1)
      })
    );
    await server.db.jobs.materializeDueSchedules(now);
    const claim = await server.db.jobs.claimNextRun('e2e-worker', 60_000, now);
    expect(claim?.run.schedule_id).toBe(schedule.id);

    await expect(
      orpc.jobs.runs.cancel({ params: { workspace: 'default', id: claim!.run.id } })
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    expect(
      await server.db.jobs.completeRun({
        runId: claim!.run.id,
        workerId: 'e2e-worker',
        leaseToken: claim!.leaseToken,
        completedAt: new Date(now.getTime() + 2_000),
        result: { ok: true }
      })
    ).toBe(true);
    const completed = await orpc.jobs.runs.list({
      params: { workspace: 'default' },
      query: { scheduleId: schedule.id, status: 'succeeded' }
    });
    expect(completed.items[0]).toMatchObject({
      status: 'succeeded',
      duration_ms: 2_000,
      result: { ok: true }
    });
  });

  test('does not allow a run from another workspace to be cancelled', async ({ server, orpc }) => {
    const otherWorkspaceSchedule = await server.db.jobs.createSchedule(
      makeSchedule({
        id: randomUUID(),
        workspace: seedIds.workspace.second,
        next_occurrence_at: now
      })
    );
    await server.db.jobs.materializeDueSchedules(now);
    const otherPage = await server.db.jobs.listRuns(seedIds.workspace.second, {
      scheduleId: otherWorkspaceSchedule.id,
      limit: 1,
      offset: 0
    });
    const otherRun = otherPage.items[0]!;

    await expect(
      orpc.jobs.runs.cancel({ params: { workspace: 'default', id: otherRun.id } })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('requires authentication', async ({ server }) => {
    const anon = createTestORPCClient(server.baseUrl);
    await expect(
      anon.jobs.schedules.list({ params: { workspace: 'default' } })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
