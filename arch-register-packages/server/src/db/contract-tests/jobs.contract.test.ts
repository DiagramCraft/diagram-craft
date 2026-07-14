import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import { createFixtureWorkspace } from './projectFixtures';
import type { JobScheduleDbCreate } from '../database';

const makeSchedule = (
  workspace: string,
  overrides: Partial<JobScheduleDbCreate> = {}
): JobScheduleDbCreate => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: randomUUID(),
    workspace,
    job_type: 'test',
    system_identity: 'system',
    payload: { source: 'test' },
    priority: 5,
    recurrence: { type: 'hours', intervalHours: 1, startsAt: now },
    enabled: true,
    next_occurrence_at: now,
    created_at: now,
    updated_at: now,
    ...overrides
  };
};

runContractSuiteAgainstBothDrivers('JobDatabase', getDb => {
  it('tracks job server status and fences updates from replaced instances', async () => {
    const db = getDb();
    const firstSeen = new Date('2026-01-01T00:00:00.000Z');
    await db.jobs.registerServer({
      id: 'worker-1',
      name: 'Primary worker',
      instance_id: randomUUID(),
      status: 'available',
      last_seen_at: firstSeen
    });
    const first = (await db.jobs.listServers()).find(server => server.id === 'worker-1')!;
    const replacementInstance = randomUUID();
    const replacementSeen = new Date('2026-01-01T00:01:00.000Z');

    expect(await db.jobs.heartbeatServer(first.id, randomUUID(), replacementSeen)).toBe(false);
    await db.jobs.registerServer({
      id: first.id,
      name: 'Renamed worker',
      instance_id: replacementInstance,
      status: 'available',
      last_seen_at: replacementSeen
    });
    expect(await db.jobs.markServerUnavailable(first.id, first.instance_id, replacementSeen)).toBe(
      false
    );
    expect(
      await db.jobs.markServerUnavailable(first.id, replacementInstance, replacementSeen)
    ).toBe(true);
    expect((await db.jobs.listServers()).find(server => server.id === first.id)).toMatchObject({
      name: 'Renamed worker',
      instance_id: replacementInstance,
      status: 'unavailable',
      last_seen_at: replacementSeen
    });
  });

  it('enqueues an explicit run with all job_run fields populated', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const schedule = await db.jobs.createSchedule(makeSchedule(workspace));
    const now = new Date('2026-01-01T00:05:00.000Z');

    const run = await db.jobs.enqueueRun(schedule.id, now);

    expect(run).toMatchObject({
      schedule_id: schedule.id,
      workspace,
      occurrence_at: now,
      coalesced_through_at: now,
      coalesced_count: 1,
      planned_at: now,
      created_at: now,
      status: 'queued'
    });
    expect(await db.jobs.enqueueRun(schedule.id, new Date('2026-01-01T00:06:00.000Z'))).toEqual(
      run
    );
    await db.jobs.updateSchedule(schedule.id, {
      job_type: schedule.job_type,
      system_identity: schedule.system_identity,
      payload: schedule.payload,
      priority: schedule.priority,
      recurrence: schedule.recurrence,
      enabled: false,
      next_occurrence_at: new Date('2099-01-01T00:00:00.000Z'),
      updated_at: now
    });
  });

  it('materializes due occurrences and coalesces them idempotently', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const schedule = await db.jobs.createSchedule(makeSchedule(workspace));
    const now = new Date('2026-01-01T05:30:00.000Z');

    expect(await db.jobs.materializeDueSchedules(now)).toBe(1);
    expect(await db.jobs.materializeDueSchedules(now)).toBe(0);

    const runs = (
      await db.jobs.listRuns(workspace, { scheduleId: schedule.id, limit: 50, offset: 0 })
    ).items;
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      status: 'queued',
      coalesced_count: 6,
      occurrence_at: new Date('2026-01-01T00:00:00.000Z'),
      coalesced_through_at: new Date('2026-01-01T05:00:00.000Z')
    });
    expect((await db.jobs.getSchedule(schedule.id))!.next_occurrence_at).toEqual(
      new Date('2026-01-01T06:00:00.000Z')
    );
  });

  it('claims one run per workspace and completes it with a fenced lease', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const now = new Date('2026-01-01T00:00:00.000Z');
    for (const existingSchedule of await db.jobs.listSchedules()) {
      const existingRuns = (
        await db.jobs.listRuns(existingSchedule.workspace, {
          scheduleId: existingSchedule.id,
          limit: 100,
          offset: 0
        })
      ).items;
      for (const run of existingRuns) {
        if (run.status === 'queued') {
          await db.jobs.cancelQueuedRun(existingSchedule.workspace, run.id, now);
        }
      }
    }
    const schedule = await db.jobs.createSchedule(makeSchedule(workspace));
    await db.jobs.materializeDueSchedules(now);

    const first = await db.jobs.claimNextRun('worker-1', 60_000, now);
    expect(first?.run.status).toBe('running');
    expect((await db.jobs.getRun(first!.run.id))!.status).toBe('running');
    expect(await db.jobs.claimNextRun('worker-2', 60_000, now)).toBeNull();
    expect(
      await db.jobs.completeRun({
        runId: first!.run.id,
        workerId: 'worker-2',
        leaseToken: first!.leaseToken,
        completedAt: now,
        result: { ok: true }
      })
    ).toBe(false);
    expect(
      await db.jobs.completeRun({
        runId: first!.run.id,
        workerId: 'worker-1',
        leaseToken: first!.leaseToken,
        completedAt: now,
        result: { ok: true }
      })
    ).toBe(true);
    expect((await db.jobs.getRun(first!.run.id))!.status).toBe('succeeded');
    expect((await db.jobs.getRun(first!.run.id))!.result).toEqual({ ok: true });

    expect(schedule.workspace).toBe(workspace);
  });

  it('fails a run when its lease expires and releases the workspace', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    await db.jobs.createSchedule(makeSchedule(workspace));
    const startedAt = new Date('2026-01-01T00:00:00.000Z');
    await db.jobs.materializeDueSchedules(startedAt);
    const claim = await db.jobs.claimNextRun('worker-1', 10_000, startedAt);

    expect(await db.jobs.recoverExpiredRuns(new Date('2026-01-01T00:00:11.000Z'))).toBe(1);
    expect((await db.jobs.getRun(claim!.run.id))!.status).toBe('failed');
    expect(
      await db.jobs.completeRun({
        runId: claim!.run.id,
        workerId: 'worker-1',
        leaseToken: claim!.leaseToken,
        completedAt: new Date('2026-01-01T00:00:12.000Z'),
        result: { stale: true }
      })
    ).toBe(false);
  });

  it('cancels queued runs without affecting the schedule', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const schedule = await db.jobs.createSchedule(makeSchedule(workspace));
    const now = new Date('2026-01-01T00:00:00.000Z');
    await db.jobs.materializeDueSchedules(now);
    const run = (
      await db.jobs.listRuns(workspace, { scheduleId: schedule.id, limit: 50, offset: 0 })
    ).items[0]!;

    expect(await db.jobs.cancelQueuedRun(workspace, run.id, now)).toMatchObject({
      status: 'cancelled'
    });
    expect((await db.jobs.getSchedule(schedule.id))!.enabled).toBe(true);
    expect(await db.jobs.cancelQueuedRun(workspace, run.id, now)).toBeNull();
  });

  it('pages, filters, and orders runs within a workspace', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const first = new Date('2026-01-01T00:00:00.000Z');
    const schedule = await db.jobs.createSchedule(
      makeSchedule(workspace, {
        next_occurrence_at: first,
        created_at: first,
        updated_at: first
      })
    );

    await db.jobs.materializeDueSchedules(first);
    await db.jobs.materializeDueSchedules(new Date('2026-01-01T01:00:00.000Z'));

    const page = await db.jobs.listRuns(workspace, { limit: 1, offset: 0 });
    expect(page.total).toBe(2);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.planned_at).toEqual(new Date('2026-01-01T01:00:00.000Z'));

    const filtered = await db.jobs.listRuns(workspace, {
      scheduleId: schedule.id,
      status: 'queued',
      plannedFrom: new Date('2026-01-01T01:00:00.000Z'),
      plannedTo: new Date('2026-01-01T01:00:00.000Z'),
      limit: 50,
      offset: 0
    });
    expect(filtered.total).toBe(1);
    expect(filtered.items[0]?.schedule_id).toBe(schedule.id);
  });
});
