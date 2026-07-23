import 'dotenv/config';
import { hostname } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '@arch-register/server/db/factory';
import { createLogger } from '@arch-register/server/utils/logger';
import { createJobServer, type JobHandler } from './worker';
import { createStorage } from '@arch-register/server/storage/storage';
import { createExternalContentJobHandler } from '@arch-register/server/domain/external-content/externalContentJobs';
import { createWebhookDeliveryHandler } from '@arch-register/server/domain/webhook/webhookDelivery';
import { createAutomationRuleExecutionHandler } from '@arch-register/server/domain/automation/automationRuleExecution';
import { AUTOMATION_RULE_JOB_TYPE } from '@arch-register/server/domain/automation/automationRuleEvaluation';
import { createGovernanceNotificationJobHandler } from '@arch-register/server/domain/governance/governanceNotifications';
import { createDocumentMetadataGenerationScanJobHandler } from '@arch-register/server/domain/document/documentMetadataGenerationJob';
import { createTechnologyEolJobHandler } from '@arch-register/server/domain/jobs/technologyEolJob';
import {
  createEntityCompletenessJobHandler,
  ENTITY_COMPLETENESS_JOB_TYPE,
  ENTITY_COMPLETENESS_SCAN_JOB_TYPE
} from '@arch-register/server/domain/catalog/entityCompletenessJob';
import { METADATA_GENERATION_SCAN_JOB_TYPE } from '@arch-register/server/domain/document/aiMetadataGenerationConstants';
import {
  createEmailDeliveryConfigFromEnv,
  createNotificationDeliveryJobHandler,
  ensureAllNotificationDeliverySchedules,
  NOTIFICATION_DELIVERY_JOB_TYPE
} from '@arch-register/server/domain/notification/emailDelivery';

const logger = createLogger('job-server');

const positiveInteger = (name: string, fallback: number) => {
  const raw = String(process.env[name] ?? fallback).trim();
  if (!/^[1-9]\d*$/.test(raw)) throw new Error(`${name} must be a positive integer`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) throw new Error(`${name} must be a positive integer`);
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
  const jobTimeoutMs = positiveInteger('JOB_SERVER_JOB_TIMEOUT_MS', 10 * 60 * 1000);
  const shutdownTimeoutMs = positiveInteger('JOB_SERVER_SHUTDOWN_TIMEOUT_MS', 30 * 1000);
  const handlers = new Map<string, JobHandler>();
  const storage = createStorage();
  await ensureAllNotificationDeliverySchedules(db);
  handlers.set('external-content.refresh', createExternalContentJobHandler(db, storage));
  handlers.set('webhook.delivery', createWebhookDeliveryHandler(db));
  handlers.set(AUTOMATION_RULE_JOB_TYPE, createAutomationRuleExecutionHandler(db));
  handlers.set('governance.notification', createGovernanceNotificationJobHandler(db));
  handlers.set(
    METADATA_GENERATION_SCAN_JOB_TYPE,
    createDocumentMetadataGenerationScanJobHandler(db, storage)
  );
  handlers.set('technology-eol', createTechnologyEolJobHandler(db));
  const entityCompletenessJobHandler = createEntityCompletenessJobHandler(db);
  handlers.set(ENTITY_COMPLETENESS_JOB_TYPE, entityCompletenessJobHandler);
  handlers.set(ENTITY_COMPLETENESS_SCAN_JOB_TYPE, entityCompletenessJobHandler);
  handlers.set(
    NOTIFICATION_DELIVERY_JOB_TYPE,
    createNotificationDeliveryJobHandler(db, createEmailDeliveryConfigFromEnv())
  );
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
    serverPingIntervalMs,
    jobTimeoutMs,
    shutdownTimeoutMs
  });

  let shutdownPromise: Promise<void> | null = null;
  const shutdown = () => {
    if (shutdownPromise) return shutdownPromise;
    shutdownPromise = (async () => {
      logger.info('Shutting down job server...');
      try {
        await server.stop();
      } catch (error) {
        logger.error(
          'Job server shutdown encountered an error',
          error instanceof Error ? error : new Error(String(error))
        );
      } finally {
        try {
          await db.core.close();
        } catch (error) {
          logger.error(
            'Failed to close the job server database',
            error instanceof Error ? error : new Error(String(error))
          );
        }
        process.exit(0);
      }
    })();
    return shutdownPromise;
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
