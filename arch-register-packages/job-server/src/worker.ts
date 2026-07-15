import { createLogger } from '@arch-register/server/utils/logger';
import type {
  DatabaseAdapter,
  JobRunClaim,
  JobRunDbResult
} from '@arch-register/server/db/database';
import { RetryableJobError, retryDelayMs } from '@arch-register/server/domain/jobs/jobRetry';

export type JobExecutionContext = {
  jobId: string;
  scheduleId: string | null;
  workspace: string;
  jobType: string;
  systemIdentity: string;
  payload: Record<string, unknown>;
};

export type JobExecutionResult = Record<string, unknown> | null | void;

export type JobHandler = (context: JobExecutionContext) => Promise<JobExecutionResult>;

export type JobServerOptions = {
  db: DatabaseAdapter;
  handlers?: ReadonlyMap<string, JobHandler>;
  workerId: string;
  serverName: string;
  instanceId: string;
  maxConcurrency: number;
  pollIntervalMs: number;
  leaseDurationMs: number;
  heartbeatIntervalMs: number;
  serverPingIntervalMs: number;
  now?: () => Date;
};

const logger = createLogger('job-server');

const formatError = (error: unknown) => (error instanceof Error ? error.message : String(error));

const executeClaim = async (
  db: DatabaseAdapter,
  handlers: ReadonlyMap<string, JobHandler>,
  claim: JobRunClaim,
  workerId: string,
  heartbeatIntervalMs: number,
  leaseDurationMs: number,
  now: () => Date
) => {
  const handler = handlers.get(claim.run.job_type);
  logger.info(
    `Picked up job ${claim.run.id} (${claim.run.job_type}) for workspace ${claim.run.workspace}`
  );
  let heartbeatInFlight = false;
  const heartbeat = setInterval(() => {
    if (heartbeatInFlight) return;
    heartbeatInFlight = true;
    void db.jobs
      .heartbeatRun(
        claim.run.id,
        workerId,
        claim.leaseToken,
        now(),
        new Date(now().getTime() + leaseDurationMs)
      )
      .then(healthy => {
        if (!healthy) logger.warn(`Lease heartbeat rejected for job ${claim.run.id}`);
      })
      .catch(error => logger.error(`Lease heartbeat failed for job ${claim.run.id}`, error))
      .finally(() => {
        heartbeatInFlight = false;
      });
  }, heartbeatIntervalMs);

  try {
    if (!handler) throw new Error(`No handler registered for job type '${claim.run.job_type}'`);
    const result = await handler({
      jobId: claim.run.id,
      scheduleId: claim.run.schedule_id,
      workspace: claim.run.workspace,
      jobType: claim.run.job_type,
      systemIdentity: claim.run.system_identity,
      payload: claim.run.payload
    });
    const completed = await db.jobs.completeRun({
      runId: claim.run.id,
      workerId,
      leaseToken: claim.leaseToken,
      completedAt: now(),
      result: result ?? null
    });
    if (!completed) {
      logger.warn(`Completion rejected for job ${claim.run.id}`);
    } else {
      logger.info(`Completed job ${claim.run.id} (${claim.run.job_type})`);
    }
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error));
    logger.error(`Job ${claim.run.id} (${claim.run.job_type}) failed`, failure);
    if (failure instanceof RetryableJobError && claim.run.attempt_count < claim.run.max_attempts) {
      const retried = await db.jobs.retryRun({
        runId: claim.run.id,
        workerId,
        leaseToken: claim.leaseToken,
        attemptedAt: now(),
        retryAt: new Date(
          now().getTime() + retryDelayMs(claim.run.attempt_count, failure.retryAfterMs)
        ),
        error: formatError(failure)
      });
      if (!retried) logger.warn(`Retry update rejected for job ${claim.run.id}`);
      return;
    }
    const failed = await db.jobs.failRun({
      runId: claim.run.id,
      workerId,
      leaseToken: claim.leaseToken,
      completedAt: now(),
      error: formatError(failure)
    });
    if (!failed) logger.warn(`Failure update rejected for job ${claim.run.id}`);
  } finally {
    clearInterval(heartbeat);
  }
};

export const createJobServer = (options: JobServerOptions) => {
  if (!Number.isInteger(options.maxConcurrency) || options.maxConcurrency < 1) {
    throw new Error('maxConcurrency must be a positive integer');
  }
  if (options.leaseDurationMs <= options.heartbeatIntervalMs) {
    throw new Error('leaseDurationMs must be greater than heartbeatIntervalMs');
  }
  if (!Number.isInteger(options.serverPingIntervalMs) || options.serverPingIntervalMs < 1) {
    throw new Error('serverPingIntervalMs must be a positive integer');
  }

  const handlers = options.handlers ?? new Map<string, JobHandler>();
  const now = options.now ?? (() => new Date());
  const running = new Set<Promise<void>>();
  let active = true;
  let loopPromise: Promise<void> | null = null;
  let serverPing: ReturnType<typeof setInterval> | null = null;
  let serverPingInFlight: Promise<void> | null = null;

  const launchAvailable = async () => {
    while (active && running.size < options.maxConcurrency) {
      const claim = await options.db.jobs.claimNextRun(
        options.workerId,
        options.leaseDurationMs,
        now()
      );
      if (!claim) return;

      let execution!: Promise<void>;
      execution = executeClaim(
        options.db,
        handlers,
        claim,
        options.workerId,
        options.heartbeatIntervalMs,
        options.leaseDurationMs,
        now
      ).finally(() => {
        running.delete(execution);
      });
      running.add(execution);
    }
  };

  const runLoop = async () => {
    while (active) {
      const timestamp = now();
      const recovered = await options.db.jobs.recoverExpiredRuns(timestamp);
      if (recovered > 0) {
        logger.warn(`Recovered ${recovered} expired job lease(s)`);
      }
      const materialized = await options.db.jobs.materializeDueSchedules(timestamp);
      if (materialized > 0) {
        logger.info(`Materialized ${materialized} due job run(s)`);
      }
      await launchAvailable();
      if (active) await new Promise(resolve => setTimeout(resolve, options.pollIntervalMs));
    }
  };

  return {
    start: () => {
      if (loopPromise) return loopPromise;
      loopPromise = (async () => {
        const startedAt = now();
        await options.db.jobs.registerServer({
          id: options.workerId,
          name: options.serverName,
          instance_id: options.instanceId,
          status: 'available',
          last_seen_at: startedAt
        });
        serverPing = setInterval(() => {
          if (serverPingInFlight) return;
          serverPingInFlight = options.db.jobs
            .heartbeatServer(options.workerId, options.instanceId, now())
            .then(updated => {
              if (!updated) logger.warn(`Status ping rejected for job server ${options.workerId}`);
            })
            .catch(error => logger.error('Job server status ping failed', error))
            .finally(() => {
              serverPingInFlight = null;
            });
        }, options.serverPingIntervalMs);
        await runLoop();
      })().catch(error => {
        logger.error('Worker loop stopped unexpectedly', error);
        throw error;
      });
      return loopPromise;
    },
    stop: async () => {
      active = false;
      if (serverPing) {
        clearInterval(serverPing);
        serverPing = null;
      }
      if (loopPromise) await loopPromise;
      await Promise.all([...running]);
      await serverPingInFlight;
      if (loopPromise) {
        const updated = await options.db.jobs.markServerUnavailable(
          options.workerId,
          options.instanceId,
          now()
        );
        if (!updated) logger.warn(`Shutdown status rejected for job server ${options.workerId}`);
      }
    },
    activeRuns: () => running.size
  };
};

export const jobRunToExecutionContext = (run: JobRunDbResult): JobExecutionContext => ({
  jobId: run.id,
  scheduleId: run.schedule_id,
  workspace: run.workspace,
  jobType: run.job_type,
  systemIdentity: run.system_identity,
  payload: run.payload
});
