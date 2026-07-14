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
  it('materializes due occurrences and coalesces them idempotently', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const schedule = await db.jobs.createSchedule(makeSchedule(workspace));
    const now = new Date('2026-01-01T05:30:00.000Z');

    expect(await db.jobs.materializeDueSchedules(now)).toBe(1);
    expect(await db.jobs.materializeDueSchedules(now)).toBe(0);

    const runs = await db.jobs.listRuns(workspace, schedule.id);
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
    for (const run of await db.jobs.listRuns()) {
      if (run.status === 'queued') await db.jobs.cancelQueuedRun(run.id, now);
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
    const run = (await db.jobs.listRuns(workspace, schedule.id))[0]!;

    expect(await db.jobs.cancelQueuedRun(run.id, now)).toMatchObject({ status: 'cancelled' });
    expect((await db.jobs.getSchedule(schedule.id))!.enabled).toBe(true);
    expect(await db.jobs.cancelQueuedRun(run.id, now)).toBeNull();
  });
});
