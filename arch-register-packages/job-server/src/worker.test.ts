import { afterAll, describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter, JobRunClaim } from '@arch-register/server/db/database';
import { setLogLevel } from '@arch-register/server/utils/logger';
import { createJobServer, type JobHandler } from './worker';

setLogLevel('fatal');
afterAll(() => setLogLevel('debug'));

const makeDb = (claim: JobRunClaim | null): DatabaseAdapter =>
  ({
    jobs: {
      claimNextRun: vi.fn(async () => {
        const result = claim;
        claim = null;
        return result;
      }),
      recoverExpiredRuns: vi.fn(async () => 0),
      materializeDueSchedules: vi.fn(async () => 0),
      heartbeatRun: vi.fn(async () => true),
      completeRun: vi.fn(async () => true),
      failRun: vi.fn(async () => true)
    }
  }) as unknown as DatabaseAdapter;

const claim: JobRunClaim = {
  leaseToken: 'lease-1',
  run: {
    id: 'run-1',
    schedule_id: 'schedule-1',
    workspace: 'workspace-1',
    job_type: 'test',
    system_identity: 'system',
    payload: { value: 1 },
    priority: 1,
    occurrence_at: new Date(),
    coalesced_through_at: new Date(),
    coalesced_count: 1,
    planned_at: new Date(),
    created_at: new Date(),
    status: 'running',
    started_at: new Date(),
    completed_at: null,
    worker_id: 'worker-1',
    lease_token: 'lease-1',
    result: null,
    error: null
  }
};

describe('createJobServer', () => {
  it('executes a claimed handler and stores its result', async () => {
    const db = makeDb(claim);
    const handler = vi.fn<JobHandler>(async context => ({ received: context.payload.value }));
    const worker = createJobServer({
      db,
      handlers: new Map([['test', handler]]),
      workerId: 'worker-1',
      maxConcurrency: 1,
      pollIntervalMs: 1,
      leaseDurationMs: 100,
      heartbeatIntervalMs: 10
    });

    const start = worker.start();
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    await worker.stop();
    await start;

    expect(db.jobs.completeRun).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-1',
        workerId: 'worker-1',
        leaseToken: 'lease-1',
        result: { received: 1 }
      })
    );
  });

  it('records handler failures', async () => {
    const db = makeDb(claim);
    const handler = vi.fn<JobHandler>(async () => {
      throw new Error('failure');
    });
    const worker = createJobServer({
      db,
      handlers: new Map([['test', handler]]),
      workerId: 'worker-1',
      maxConcurrency: 1,
      pollIntervalMs: 1,
      leaseDurationMs: 100,
      heartbeatIntervalMs: 10
    });

    const start = worker.start();
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    await worker.stop();
    await start;

    expect(db.jobs.failRun).toHaveBeenCalledWith(expect.objectContaining({ error: 'failure' }));
  });
});
