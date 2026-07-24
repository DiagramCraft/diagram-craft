import { afterAll, describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter, JobRunClaim } from '@arch-register/server/db/database';
import { setLogLevel } from '@arch-register/server/utils/logger';
import { createJobServer, type JobHandler } from './worker';
import { RetryableJobError } from '@arch-register/server/domain/jobs/jobRetry';

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
      registerServer: vi.fn(async input => input),
      heartbeatServer: vi.fn(async () => true),
      markServerUnavailable: vi.fn(async () => true),
      heartbeatRun: vi.fn(async () => true),
      completeRun: vi.fn(async () => true),
      failRun: vi.fn(async () => true),
      retryRun: vi.fn(async () => true)
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
    error: null,
    attempt_count: 1,
    max_attempts: 1
  }
};

describe('createJobServer', () => {
  it('records periodic status pings', async () => {
    const db = makeDb(null);
    const worker = createJobServer({
      db,
      workerId: 'worker-1',
      serverName: 'Worker one',
      instanceId: 'instance-1',
      maxConcurrency: 1,
      pollIntervalMs: 1,
      leaseDurationMs: 100,
      heartbeatIntervalMs: 10,
      serverPingIntervalMs: 5,
      jobTimeoutMs: 1_000,
      shutdownTimeoutMs: 1_000
    });

    const start = worker.start();
    await vi.waitFor(() => expect(db.jobs.heartbeatServer).toHaveBeenCalled());
    await worker.stop();
    await start;

    expect(db.jobs.markServerUnavailable).toHaveBeenCalled();
  });

  it('executes a claimed handler and stores its result', async () => {
    const db = makeDb(claim);
    const handler = vi.fn<JobHandler>(async context => ({ received: context.payload.value }));
    const worker = createJobServer({
      db,
      handlers: new Map([['test', handler]]),
      workerId: 'worker-1',
      serverName: 'Worker one',
      instanceId: 'instance-1',
      maxConcurrency: 1,
      pollIntervalMs: 1,
      leaseDurationMs: 100,
      heartbeatIntervalMs: 10,
      serverPingIntervalMs: 10,
      jobTimeoutMs: 1_000,
      shutdownTimeoutMs: 1_000
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
    expect(db.jobs.registerServer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'worker-1', name: 'Worker one', status: 'available' })
    );
    expect(db.jobs.markServerUnavailable).toHaveBeenCalledWith(
      'worker-1',
      'instance-1',
      expect.any(Date)
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
      serverName: 'Worker one',
      instanceId: 'instance-1',
      maxConcurrency: 1,
      pollIntervalMs: 1,
      leaseDurationMs: 100,
      heartbeatIntervalMs: 10,
      serverPingIntervalMs: 10,
      jobTimeoutMs: 1_000,
      shutdownTimeoutMs: 1_000
    });

    const start = worker.start();
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    await worker.stop();
    await start;

    expect(db.jobs.failRun).toHaveBeenCalledWith(expect.objectContaining({ error: 'failure' }));
  });

  it('aborts execution when the lease heartbeat is rejected', async () => {
    const db = makeDb(claim);
    (db.jobs.heartbeatRun as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const handler = vi.fn<JobHandler>(
      ({ signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason));
        })
    );
    const worker = createJobServer({
      db,
      handlers: new Map([['test', handler]]),
      workerId: 'worker-1',
      serverName: 'Worker one',
      instanceId: 'instance-1',
      maxConcurrency: 1,
      pollIntervalMs: 1,
      leaseDurationMs: 100,
      heartbeatIntervalMs: 5,
      serverPingIntervalMs: 10,
      jobTimeoutMs: 1_000,
      shutdownTimeoutMs: 1_000
    });

    const start = worker.start();
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(worker.activeRuns()).toBe(0));
    await worker.stop();
    await start;

    expect(db.jobs.completeRun).not.toHaveBeenCalled();
    expect(db.jobs.failRun).not.toHaveBeenCalled();
    expect(db.jobs.retryRun).not.toHaveBeenCalled();
  });

  it('aborts execution after two consecutive heartbeat errors', async () => {
    const db = makeDb(claim);
    (db.jobs.heartbeatRun as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('connection reset'))
      .mockRejectedValueOnce(new Error('connection reset'));
    const handler = vi.fn<JobHandler>(
      ({ signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason));
        })
    );
    const worker = createJobServer({
      db,
      handlers: new Map([['test', handler]]),
      workerId: 'worker-1',
      serverName: 'Worker one',
      instanceId: 'instance-1',
      maxConcurrency: 1,
      pollIntervalMs: 1,
      leaseDurationMs: 100,
      heartbeatIntervalMs: 5,
      serverPingIntervalMs: 10,
      jobTimeoutMs: 1_000,
      shutdownTimeoutMs: 1_000
    });

    const start = worker.start();
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(worker.activeRuns()).toBe(0));
    await worker.stop();
    await start;

    expect(db.jobs.completeRun).not.toHaveBeenCalled();
    expect(db.jobs.failRun).not.toHaveBeenCalled();
    expect(db.jobs.retryRun).not.toHaveBeenCalled();
  });

  it('aborts timed-out execution and leaves the run for lease recovery', async () => {
    const db = makeDb(claim);
    const handler = vi.fn<JobHandler>(
      ({ signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason));
        })
    );
    const worker = createJobServer({
      db,
      handlers: new Map([['test', handler]]),
      workerId: 'worker-1',
      serverName: 'Worker one',
      instanceId: 'instance-1',
      maxConcurrency: 1,
      pollIntervalMs: 1,
      leaseDurationMs: 100,
      heartbeatIntervalMs: 10,
      serverPingIntervalMs: 10,
      jobTimeoutMs: 10,
      shutdownTimeoutMs: 1_000
    });

    const start = worker.start();
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(worker.activeRuns()).toBe(0));
    await worker.stop();
    await start;

    expect(db.jobs.completeRun).not.toHaveBeenCalled();
    expect(db.jobs.failRun).not.toHaveBeenCalled();
    expect(db.jobs.retryRun).not.toHaveBeenCalled();
  });

  it('keeps polling after a transient database error', async () => {
    const db = makeDb(claim);
    (db.jobs.recoverExpiredRuns as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('connection reset')
    );
    const handler = vi.fn<JobHandler>(async () => null);
    const worker = createJobServer({
      db,
      handlers: new Map([['test', handler]]),
      workerId: 'worker-1',
      serverName: 'Worker one',
      instanceId: 'instance-1',
      maxConcurrency: 1,
      pollIntervalMs: 1,
      leaseDurationMs: 100,
      heartbeatIntervalMs: 10,
      serverPingIntervalMs: 10,
      jobTimeoutMs: 1_000,
      shutdownTimeoutMs: 1_000
    });

    const start = worker.start();
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    await worker.stop();
    await start;

    expect(db.jobs.completeRun).toHaveBeenCalled();
  });

  it('validates all timing options at the worker boundary', () => {
    const db = makeDb(null);
    const options = {
      db,
      workerId: 'worker-1',
      serverName: 'Worker one',
      instanceId: 'instance-1',
      maxConcurrency: 1,
      pollIntervalMs: 1,
      leaseDurationMs: 100,
      heartbeatIntervalMs: 10,
      serverPingIntervalMs: 10,
      jobTimeoutMs: 1_000,
      shutdownTimeoutMs: 1_000
    };

    expect(() => createJobServer({ ...options, pollIntervalMs: 0 })).toThrow(
      'pollIntervalMs must be a positive integer'
    );
    expect(() => createJobServer({ ...options, heartbeatIntervalMs: 0 })).toThrow(
      'heartbeatIntervalMs must be a positive integer'
    );
    expect(() => createJobServer({ ...options, jobTimeoutMs: 0 })).toThrow(
      'jobTimeoutMs must be a positive integer'
    );
  });

  it('cleans up and marks the server unavailable when startup fails', async () => {
    const db = makeDb(null);
    (db.jobs.registerServer as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('database unavailable')
    );
    const worker = createJobServer({
      db,
      workerId: 'worker-1',
      serverName: 'Worker one',
      instanceId: 'instance-1',
      maxConcurrency: 1,
      pollIntervalMs: 1,
      leaseDurationMs: 100,
      heartbeatIntervalMs: 10,
      serverPingIntervalMs: 10,
      jobTimeoutMs: 1_000,
      shutdownTimeoutMs: 1_000
    });

    const start = worker.start();
    await expect(start).rejects.toThrow('database unavailable');
    await worker.stop();

    expect(db.jobs.markServerUnavailable).toHaveBeenCalledWith(
      'worker-1',
      'instance-1',
      expect.any(Date)
    );
  });

  it('makes stop idempotent', async () => {
    const db = makeDb(null);
    const worker = createJobServer({
      db,
      workerId: 'worker-1',
      serverName: 'Worker one',
      instanceId: 'instance-1',
      maxConcurrency: 1,
      pollIntervalMs: 1,
      leaseDurationMs: 100,
      heartbeatIntervalMs: 10,
      serverPingIntervalMs: 10,
      jobTimeoutMs: 1_000,
      shutdownTimeoutMs: 1_000
    });

    const start = worker.start();
    const firstStop = worker.stop();
    const secondStop = worker.stop();
    expect(secondStop).toBe(firstStop);
    await firstStop;
    await start;

    expect(db.jobs.markServerUnavailable).toHaveBeenCalledTimes(1);
  });

  it('bounds shutdown when a polling database call hangs', async () => {
    const db = makeDb(null);
    (db.jobs.recoverExpiredRuns as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise<number>(() => undefined)
    );
    const worker = createJobServer({
      db,
      workerId: 'worker-1',
      serverName: 'Worker one',
      instanceId: 'instance-1',
      maxConcurrency: 1,
      pollIntervalMs: 1,
      leaseDurationMs: 100,
      heartbeatIntervalMs: 10,
      serverPingIntervalMs: 10,
      jobTimeoutMs: 1_000,
      shutdownTimeoutMs: 20
    });

    worker.start();
    await vi.waitFor(() => expect(db.jobs.recoverExpiredRuns).toHaveBeenCalled());
    await worker.stop();

    expect(db.jobs.markServerUnavailable).toHaveBeenCalled();
  });

  it('requeues retryable handler failures while attempts remain', async () => {
    const retryClaim = {
      ...claim,
      run: { ...claim.run, attempt_count: 1, max_attempts: 5 }
    };
    const db = makeDb(retryClaim);
    const handler = vi.fn<JobHandler>(async () => {
      throw new RetryableJobError('temporary');
    });
    const worker = createJobServer({
      db,
      handlers: new Map([['test', handler]]),
      workerId: 'worker-1',
      serverName: 'Worker one',
      instanceId: 'instance-1',
      maxConcurrency: 1,
      pollIntervalMs: 1,
      leaseDurationMs: 100,
      heartbeatIntervalMs: 10,
      serverPingIntervalMs: 10,
      jobTimeoutMs: 1_000,
      shutdownTimeoutMs: 1_000
    });

    const start = worker.start();
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    await worker.stop();
    await start;

    expect(db.jobs.retryRun).toHaveBeenCalledWith(
      expect.objectContaining({ runId: 'run-1', error: 'temporary' })
    );
    expect(db.jobs.failRun).not.toHaveBeenCalled();
  });
});
