import 'dotenv/config';
import { hostname } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '@arch-register/server/db/factory';
import { createLogger } from '@arch-register/server/utils/logger';
import { createJobServer, type JobHandler } from './worker';
import { createStorage } from '@arch-register/server/storage/storage';
import { createExternalContentJobHandler } from '@arch-register/server/domain/external-content/externalContentJobs';

const logger = createLogger('job-server');

const positiveInteger = (name: string, fallback: number) => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
  return value;
};

const main = async () => {
  const db = await createDatabase();
  if (db.core.driver === 'sqlite' && process.env['JOB_SERVER_ALLOW_SQLITE'] !== 'true') {
    await db.core.close();
    throw new Error(
      'The job server requires PostgreSQL. Set JOB_SERVER_ALLOW_SQLITE=true only for local single-worker development.'
    );
  }

  const workerId = process.env['JOB_SERVER_ID'] ?? hostname();
  if (workerId.trim().length === 0) throw new Error('JOB_SERVER_ID must not be empty');
  const serverName = process.env['JOB_SERVER_NAME'] ?? hostname();
  if (serverName.trim().length === 0) throw new Error('JOB_SERVER_NAME must not be empty');
  const instanceId = randomUUID();
  const maxConcurrency = positiveInteger('JOB_SERVER_MAX_CONCURRENCY', 2);
  const pollIntervalMs = positiveInteger('JOB_SERVER_POLL_INTERVAL_MS', 1000);
  const leaseDurationMs = positiveInteger('JOB_SERVER_LEASE_DURATION_MS', 30000);
  const heartbeatIntervalMs = positiveInteger('JOB_SERVER_HEARTBEAT_INTERVAL_MS', 5000);
  const serverPingIntervalMs = positiveInteger('JOB_SERVER_PING_INTERVAL_MS', 60000);
  const handlers = new Map<string, JobHandler>();
  const storage = createStorage();
  handlers.set('external-content.refresh', createExternalContentJobHandler(db, storage));
  const server = createJobServer({
    db,
    handlers,
    workerId,
    serverName,
    instanceId,
    maxConcurrency,
    pollIntervalMs,
    leaseDurationMs,
    heartbeatIntervalMs,
    serverPingIntervalMs
  });

  const shutdown = async () => {
    logger.info('Shutting down job server...');
    await server.stop();
    await db.core.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  logger.info(
    `Job server ${serverName} (${workerId}) started with concurrency ${maxConcurrency} using ${db.core.driver}`
  );
  await server.start();
};

main().catch(error => {
  logger.error(
    'Failed to start job server',
    error instanceof Error ? error : new Error(String(error))
  );
  process.exit(1);
});
