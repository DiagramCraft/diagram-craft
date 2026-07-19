import { createLogger } from '@arch-register/server/utils/logger';
import type { DatabaseAdapter, JobRunClaim } from '@arch-register/server/db/database';
import { RetryableJobError, retryDelayMs } from '@arch-register/server/domain/jobs/jobRetry';

export type JobExecutionContext = {
  jobId: string;
  scheduleId: string | null;
  workspace: string;
  jobType: string;
  systemIdentity: string;
  payload: Record<string, unknown>;
  // Aborted when the run's lease is lost; handlers should stop side effects as
  // another worker may already be executing the same run.
  signal: AbortSignal;
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
  jobTimeoutMs: number;
  shutdownTimeoutMs: number;
  now?: () => Date;
};

const logger = createLogger('job-server');

const MAX_POLL_BACKOFF_MS = 60_000;

const formatError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/https?:\/\/\S+/gi, '[redacted-url]').slice(0, 2_000);
};

const assertPositiveSafeInteger = (name: string, value: number) => {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
};

const createAbortPromise = (signal: AbortSignal) => {
  let rejectWithReason!: (reason?: unknown) => void;
  const promise = new Promise<never>(reject => {
    rejectWithReason = () => reject(undefined as never);
  });
  const onAbort = () => rejectWithReason(signal.reason);
  if (signal.aborted) onAbort();
  else signal.addEventListener('abort', onAbort, { once: true });
  return {
    promise,
    cleanup: () => signal.removeEventListener('abort', onAbort)
  };
};

const stoppableDelay = (delayMs: number, signal: AbortSignal) =>
  new Promise<void>(resolve => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const finish = () => {
      if (timeout) clearTimeout(timeout);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    if (signal.aborted) {
      finish();
      return;
    }
    signal.addEventListener('abort', finish, { once: true });
    timeout = setTimeout(finish, delayMs);
  });

const waitForCompletion = async (promise: Promise<unknown>, timeoutMs: number) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const deadline = new Promise<boolean>(resolve => {
    timeout = setTimeout(() => resolve(false), timeoutMs);
  });
  const completed = promise.then(
    () => true,
    error => {
      logger.error(
        'Shutdown operation failed',
        error instanceof Error ? error : new Error(String(error))
      );
      return true;
    }
  );
  const result = await Promise.race([completed, deadline]);
  if (timeout) clearTimeout(timeout);
  return result;
};

const executeClaim = async (
  db: DatabaseAdapter,
  handlers: ReadonlyMap<string, JobHandler>,
  claim: JobRunClaim,
  workerId: string,
  heartbeatIntervalMs: number,
  leaseDurationMs: number,
  now: () => Date,
  shutdownSignal: AbortSignal,
  jobTimeoutMs: number
) => {
  const handler = handlers.get(claim.run.job_type);
  logger.info(
    `Picked up job ${claim.run.id} (${claim.run.job_type}) for workspace ${claim.run.workspace}`
  );
  const abortController = new AbortController();
  let abortReason = 'execution aborted';
  const abortExecution = (reason: string) => {
    if (abortController.signal.aborted) return;
    abortReason = reason;
    abortController.abort(new Error(reason));
  };
  const onShutdown = () => abortExecution('job server is shutting down');
  shutdownSignal.addEventListener('abort', onShutdown, { once: true });
  let heartbeatInFlight = false;
  let consecutiveHeartbeatFailures = 0;
  const heartbeat = setInterval(() => {
    if (heartbeatInFlight || abortController.signal.aborted) return;
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
        if (healthy) {
          consecutiveHeartbeatFailures = 0;
        } else if (!abortController.signal.aborted) {
          logger.warn(`Lease heartbeat rejected for job ${claim.run.id}; aborting execution`);
          abortExecution(`lease lost for job ${claim.run.id}`);
        }
      })
      .catch(error => {
        consecutiveHeartbeatFailures++;
        logger.error(`Lease heartbeat failed for job ${claim.run.id}`, error);
        if (consecutiveHeartbeatFailures >= 2) {
          abortExecution(`lease heartbeat unavailable for job ${claim.run.id}`);
        }
      })
      .finally(() => {
        heartbeatInFlight = false;
      });
  }, heartbeatIntervalMs);
  const timeout = setTimeout(() => {
    logger.warn(`Job ${claim.run.id} exceeded its ${jobTimeoutMs}ms execution timeout`);
    abortExecution(`job execution timed out after ${jobTimeoutMs}ms`);
  }, jobTimeoutMs);
  let cleanupAbortListener: (() => void) | null = null;

  try {
    if (!handler) throw new Error(`No handler registered for job type '${claim.run.job_type}'`);
    const execution = Promise.resolve().then(() =>
      handler({
        jobId: claim.run.id,
        scheduleId: claim.run.schedule_id,
        workspace: claim.run.workspace,
        jobType: claim.run.job_type,
        systemIdentity: claim.run.system_identity,
        payload: claim.run.payload,
        signal: abortController.signal
      })
    );
    execution.catch(() => undefined);
    const abort = createAbortPromise(abortController.signal);
    cleanupAbortListener = abort.cleanup;
    const result = await Promise.race([execution, abort.promise]);
    abort.cleanup();
    cleanupAbortListener = null;
    if (abortController.signal.aborted) return;
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
    if (abortController.signal.aborted) {
      logger.warn(
        `Job ${claim.run.id} (${claim.run.job_type}) stopped: ${abortReason}; lease recovery will handle the run`
      );
      return;
    }
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
    clearTimeout(timeout);
    cleanupAbortListener?.();
    shutdownSignal.removeEventListener('abort', onShutdown);
  }
};

export const createJobServer = (options: JobServerOptions) => {
  assertPositiveSafeInteger('maxConcurrency', options.maxConcurrency);
  assertPositiveSafeInteger('pollIntervalMs', options.pollIntervalMs);
  assertPositiveSafeInteger('leaseDurationMs', options.leaseDurationMs);
  assertPositiveSafeInteger('heartbeatIntervalMs', options.heartbeatIntervalMs);
  assertPositiveSafeInteger('serverPingIntervalMs', options.serverPingIntervalMs);
  assertPositiveSafeInteger('jobTimeoutMs', options.jobTimeoutMs);
  assertPositiveSafeInteger('shutdownTimeoutMs', options.shutdownTimeoutMs);
  if (options.leaseDurationMs <= options.heartbeatIntervalMs) {
    throw new Error('leaseDurationMs must be greater than heartbeatIntervalMs');
  }

  const handlers = options.handlers ?? new Map<string, JobHandler>();
  const now = options.now ?? (() => new Date());
  const running = new Set<Promise<void>>();
  let active = true;
  let loopPromise: Promise<void> | null = null;
  let stopPromise: Promise<void> | null = null;
  const shutdownController = new AbortController();
  let serverPing: ReturnType<typeof setInterval> | null = null;
  let serverPingInFlight: Promise<void> | null = null;

  const launchAvailable = async () => {
    while (active && !shutdownController.signal.aborted && running.size < options.maxConcurrency) {
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
        now,
        shutdownController.signal,
        options.jobTimeoutMs
      )
        .catch(error =>
          logger.error(
            `Job execution for ${claim.run.id} failed unexpectedly`,
            error instanceof Error ? error : new Error(String(error))
          )
        )
        .finally(() => {
          running.delete(execution);
        });
      running.add(execution);
    }
  };

  const runLoop = async () => {
    let consecutiveFailures = 0;
    while (active && !shutdownController.signal.aborted) {
      try {
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
        consecutiveFailures = 0;
      } catch (error) {
        consecutiveFailures++;
        logger.error(
          `Job polling iteration failed (${consecutiveFailures} consecutive failure(s))`,
          error instanceof Error ? error : new Error(String(error))
        );
      }
      if (!active || shutdownController.signal.aborted) break;
      const delayMs =
        consecutiveFailures === 0
          ? options.pollIntervalMs
          : Math.min(options.pollIntervalMs * 2 ** consecutiveFailures, MAX_POLL_BACKOFF_MS);
      await stoppableDelay(delayMs, shutdownController.signal);
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
          if (!active || shutdownController.signal.aborted || serverPingInFlight) return;
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
    stop: () => {
      if (stopPromise) return stopPromise;
      stopPromise = (async () => {
        active = false;
        shutdownController.abort(new Error('job server is shutting down'));
        if (serverPing) {
          clearInterval(serverPing);
          serverPing = null;
        }

        const shutdownDeadline = Date.now() + options.shutdownTimeoutMs;
        const waitForShutdownOperation = async (operation: Promise<unknown>) => {
          const remaining = Math.max(0, shutdownDeadline - Date.now());
          return remaining > 0 ? waitForCompletion(operation, remaining) : false;
        };

        if (loopPromise) await waitForShutdownOperation(loopPromise);
        if (running.size > 0) {
          const completed = await waitForShutdownOperation(Promise.all([...running]));
          if (!completed) {
            logger.warn(
              `Shutdown deadline reached with ${running.size} job execution(s) still active; leases will recover after expiry`
            );
          }
        }
        if (serverPingInFlight) await waitForShutdownOperation(serverPingInFlight);

        const markUnavailable = options.db.jobs
          .markServerUnavailable(options.workerId, options.instanceId, now())
          .then(updated => {
            if (!updated)
              logger.warn(`Shutdown status rejected for job server ${options.workerId}`);
          });
        await waitForShutdownOperation(markUnavailable);
      })();
      return stopPromise;
    },
    activeRuns: () => running.size
  };
};
